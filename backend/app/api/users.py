import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
import structlog

from app.database import get_db
from app.models.user import User, UserRole, ConfidentialityLevel
from app.api.auth import get_current_active_user
from app.services.auth_service import hash_password

router = APIRouter(prefix="/users", tags=["Utilisateurs"])
logger = structlog.get_logger()


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str
    full_name_ar: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    institution_id: Optional[str] = None
    primary_role: UserRole = UserRole.READER
    confidentiality_level: ConfidentialityLevel = ConfidentialityLevel.INTERNAL
    preferred_language: str = "fr"


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    full_name_ar: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    institution_id: Optional[str] = None
    primary_role: Optional[UserRole] = None
    confidentiality_level: Optional[ConfidentialityLevel] = None
    preferred_language: Optional[str] = None
    is_active: Optional[bool] = None


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_superuser and current_user.primary_role not in [
        UserRole.SUPER_ADMIN, UserRole.MINISTRY_ADMIN, UserRole.NATIONAL_ARCHIVIST
    ]:
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    existing = await db.execute(
        select(User).where((User.username == data.username) | (User.email == data.email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Nom d'utilisateur ou email déjà utilisé")

    user = User(
        username=data.username,
        email=data.email,
        full_name=data.full_name,
        full_name_ar=data.full_name_ar,
        phone=data.phone,
        position=data.position,
        hashed_password=hash_password(data.password),
        primary_role=data.primary_role,
        confidentiality_level=data.confidentiality_level,
        preferred_language=data.preferred_language,
        is_active=True,
        is_verified=True,
        created_by=current_user.id,
    )
    if data.institution_id:
        try:
            user.institution_id = uuid.UUID(data.institution_id)
        except ValueError:
            pass

    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _format_user(user)


@router.get("/")
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    institution_id: Optional[str] = None,
    role: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import and_, or_
    filters = []
    if institution_id:
        try:
            filters.append(User.institution_id == uuid.UUID(institution_id))
        except ValueError:
            pass
    if role:
        filters.append(User.primary_role == role)
    if is_active is not None:
        filters.append(User.is_active == is_active)
    if search:
        filters.append(or_(
            User.full_name.ilike(f"%{search}%"),
            User.username.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
        ))

    query = select(User)
    if filters:
        query = query.where(and_(*filters))

    total_r = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_r.scalar()

    query = query.offset((page - 1) * size).limit(size).order_by(User.full_name)
    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "size": size,
        "items": [_format_user(u) for u in users],
    }


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        u_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(User).where(User.id == u_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    return _format_user(user, detailed=True)


@router.patch("/{user_id}")
async def update_user(
    user_id: str,
    data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if str(current_user.id) != user_id and not current_user.is_superuser:
        if current_user.primary_role not in [UserRole.SUPER_ADMIN, UserRole.MINISTRY_ADMIN]:
            raise HTTPException(status_code=403, detail="Droits insuffisants")

    try:
        u_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(User).where(User.id == u_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field == "institution_id" and value:
            try:
                value = uuid.UUID(value)
            except ValueError:
                continue
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return _format_user(user)


@router.delete("/{user_id}")
async def deactivate_user(
    user_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_superuser and current_user.primary_role not in [
        UserRole.SUPER_ADMIN, UserRole.MINISTRY_ADMIN
    ]:
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    try:
        u_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(User).where(User.id == u_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    user.is_active = False
    await db.commit()
    return {"message": "Compte utilisateur désactivé"}


def _format_user(user: User, detailed: bool = False) -> dict:
    base = {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "full_name_ar": user.full_name_ar,
        "primary_role": user.primary_role.value if user.primary_role else None,
        "confidentiality_level": user.confidentiality_level.value if user.confidentiality_level else None,
        "institution_id": str(user.institution_id) if user.institution_id else None,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "preferred_language": user.preferred_language,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }
    if detailed:
        base.update({
            "phone": user.phone,
            "position": user.position,
            "department": user.department,
            "two_factor_enabled": user.two_factor_enabled,
            "avatar_url": user.avatar_url,
            "employee_id": user.employee_id,
        })
    return base
