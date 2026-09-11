import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
import structlog

from app.database import get_db
from app.models.institution import Institution, InstitutionType, InstitutionStatus
from app.models.document import Document
from app.models.user import User
from app.api.auth import get_current_active_user

router = APIRouter(prefix="/institutions", tags=["Institutions"])
logger = structlog.get_logger()


class InstitutionCreate(BaseModel):
    code: str
    name: str
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    acronym: Optional[str] = None
    type: InstitutionType
    parent_id: Optional[str] = None
    address: Optional[str] = None
    city: str = "Djibouti"
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    minister_name: Optional[str] = None
    director_name: Optional[str] = None
    storage_quota_gb: float = 100.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class InstitutionUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    minister_name: Optional[str] = None
    director_name: Optional[str] = None
    storage_quota_gb: Optional[float] = None
    status: Optional[InstitutionStatus] = None


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_institution(
    data: InstitutionCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Institution).where(Institution.code == data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Code institution '{data.code}' déjà utilisé")

    parent_id = None
    level = 1
    hierarchy_path = f"/{data.code}"

    if data.parent_id:
        try:
            parent_uuid = uuid.UUID(data.parent_id)
            parent_result = await db.execute(select(Institution).where(Institution.id == parent_uuid))
            parent = parent_result.scalar_one_or_none()
            if not parent:
                raise HTTPException(status_code=404, detail="Institution parente non trouvée")
            parent_id = parent_uuid
            level = parent.level + 1
            hierarchy_path = f"{parent.hierarchy_path}/{data.code}"
        except ValueError:
            raise HTTPException(status_code=400, detail="ID parent invalide")

    institution = Institution(
        code=data.code,
        name=data.name,
        name_ar=data.name_ar,
        name_en=data.name_en,
        acronym=data.acronym,
        type=data.type,
        parent_id=parent_id,
        level=level,
        hierarchy_path=hierarchy_path,
        address=data.address,
        city=data.city,
        phone=data.phone,
        email=data.email,
        website=data.website,
        minister_name=data.minister_name,
        director_name=data.director_name,
        storage_quota_gb=data.storage_quota_gb,
        latitude=data.latitude,
        longitude=data.longitude,
        created_by=current_user.id,
    )

    db.add(institution)
    await db.commit()
    await db.refresh(institution)

    logger.info("Institution created", code=data.code, type=data.type)
    return _format_institution(institution)


@router.get("/")
async def list_institutions(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    type: Optional[str] = None,
    parent_id: Optional[str] = None,
    search: Optional[str] = None,
    level: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import and_, or_
    query = select(Institution)
    filters = [Institution.status == InstitutionStatus.ACTIVE]

    if type:
        filters.append(Institution.type == type)
    if level is not None:
        filters.append(Institution.level == level)
    if parent_id:
        try:
            filters.append(Institution.parent_id == uuid.UUID(parent_id))
        except ValueError:
            pass
    if search:
        filters.append(or_(
            Institution.name.ilike(f"%{search}%"),
            Institution.code.ilike(f"%{search}%"),
            Institution.acronym.ilike(f"%{search}%"),
        ))

    query = query.where(and_(*filters))
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.offset((page - 1) * size).limit(size).order_by(Institution.level, Institution.name)
    result = await db.execute(query)
    institutions = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "size": size,
        "items": [_format_institution(i) for i in institutions],
    }


@router.get("/tree")
async def get_institution_tree(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Institution)
        .where(Institution.status == InstitutionStatus.ACTIVE)
        .order_by(Institution.level, Institution.name)
    )
    all_institutions = result.scalars().all()

    inst_map = {str(i.id): _format_institution(i) for i in all_institutions}
    tree = []

    for inst in all_institutions:
        inst_data = inst_map[str(inst.id)]
        inst_data["children"] = []
        if inst.parent_id and str(inst.parent_id) in inst_map:
            parent = inst_map[str(inst.parent_id)]
            if "children" not in parent:
                parent["children"] = []
            parent["children"].append(inst_data)
        else:
            tree.append(inst_data)

    return {"tree": tree, "total": len(all_institutions)}


@router.get("/{inst_id}")
async def get_institution(
    inst_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        inst_uuid = uuid.UUID(inst_id)
    except ValueError:
        existing = await db.execute(select(Institution).where(Institution.code == inst_id))
        inst = existing.scalar_one_or_none()
        if not inst:
            raise HTTPException(status_code=404, detail="Institution non trouvée")
        return _format_institution(inst, detailed=True)

    result = await db.execute(select(Institution).where(Institution.id == inst_uuid))
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution non trouvée")

    return _format_institution(inst, detailed=True)


@router.get("/{inst_id}/stats")
async def get_institution_stats(
    inst_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        inst_uuid = uuid.UUID(inst_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    doc_count = await db.execute(
        select(func.count(Document.id)).where(Document.institution_id == inst_uuid)
    )
    user_count = await db.execute(
        select(func.count(User.id)).where(User.institution_id == inst_uuid)
    )
    size_result = await db.execute(
        select(func.sum(Document.file_size)).where(Document.institution_id == inst_uuid)
    )

    return {
        "institution_id": inst_id,
        "document_count": doc_count.scalar() or 0,
        "user_count": user_count.scalar() or 0,
        "storage_used_bytes": size_result.scalar() or 0,
        "storage_used_gb": round((size_result.scalar() or 0) / (1024**3), 2),
    }


@router.patch("/{inst_id}")
async def update_institution(
    inst_id: str,
    data: InstitutionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        inst_uuid = uuid.UUID(inst_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(Institution).where(Institution.id == inst_uuid))
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail="Institution non trouvée")

    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(inst, field, value)

    await db.commit()
    await db.refresh(inst)
    return _format_institution(inst)


def _format_institution(inst: Institution, detailed: bool = False) -> dict:
    base = {
        "id": str(inst.id),
        "code": inst.code,
        "name": inst.name,
        "name_ar": inst.name_ar,
        "name_en": inst.name_en,
        "acronym": inst.acronym,
        "type": inst.type.value if inst.type else None,
        "status": inst.status.value if inst.status else None,
        "parent_id": str(inst.parent_id) if inst.parent_id else None,
        "level": inst.level,
        "hierarchy_path": inst.hierarchy_path,
        "city": inst.city,
        "latitude": inst.latitude,
        "longitude": inst.longitude,
        "document_count": inst.document_count,
        "storage_used_gb": inst.storage_used_gb,
        "storage_quota_gb": inst.storage_quota_gb,
        "created_at": inst.created_at.isoformat() if inst.created_at else None,
    }
    if detailed:
        base.update({
            "address": inst.address,
            "phone": inst.phone,
            "email": inst.email,
            "website": inst.website,
            "minister_name": inst.minister_name,
            "director_name": inst.director_name,
            "archivist_name": inst.archivist_name,
            "logo_url": inst.logo_url,
        })
    return base
