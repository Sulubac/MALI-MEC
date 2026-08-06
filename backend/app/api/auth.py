from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, EmailStr
import structlog

from app.database import get_db
from app.models.user import User, UserSession, UserRole
from app.services.auth_service import (
    authenticate_user, create_access_token, create_refresh_token,
    decode_token, hash_password, get_current_user, generate_totp_secret,
    verify_totp, get_totp_uri, hash_token,
)
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = structlog.get_logger()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str
    full_name_ar: Optional[str] = None
    phone: Optional[str] = None
    institution_id: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class RefreshRequest(BaseModel):
    refresh_token: str


async def get_current_active_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentification requise",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user = await get_current_user(db, token)
    if not user:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Compte désactivé")
    return user


async def require_role(*roles: UserRole):
    async def checker(current_user: User = Depends(get_current_active_user)):
        if current_user.is_superuser:
            return current_user
        if current_user.primary_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Droits insuffisants pour cette opération",
            )
        return current_user
    return checker


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Compte désactivé. Contactez l'administrateur.")

    user.last_login = datetime.utcnow()
    user.last_login_ip = request.client.host if request.client else None
    user.failed_login_attempts = 0
    await db.commit()

    token_data = {"sub": str(user.id), "role": user.primary_role}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    logger.info("User logged in", user_id=str(user.id), username=user.username)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.primary_role,
            "institution_id": str(user.institution_id) if user.institution_id else None,
            "confidentiality_level": user.confidentiality_level,
            "two_factor_enabled": user.two_factor_enabled,
            "preferred_language": user.preferred_language,
        },
    )


@router.post("/refresh")
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token de rafraîchissement invalide")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")

    token_data = {"sub": str(user.id), "role": user.primary_role}
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.post("/register")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where((User.username == data.username) | (User.email == data.email))
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur ou email déjà utilisé")

    user = User(
        username=data.username,
        email=data.email,
        full_name=data.full_name,
        full_name_ar=data.full_name_ar,
        phone=data.phone,
        hashed_password=hash_password(data.password),
        primary_role=UserRole.READER,
        is_active=True,
        is_verified=False,
    )
    if data.institution_id:
        import uuid
        try:
            user.institution_id = uuid.UUID(data.institution_id)
        except ValueError:
            pass

    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info("New user registered", user_id=str(user.id), username=user.username)
    return {"message": "Compte créé avec succès. En attente de validation.", "user_id": str(user.id)}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_active_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "full_name_ar": current_user.full_name_ar,
        "role": current_user.primary_role,
        "institution_id": str(current_user.institution_id) if current_user.institution_id else None,
        "confidentiality_level": current_user.confidentiality_level,
        "two_factor_enabled": current_user.two_factor_enabled,
        "preferred_language": current_user.preferred_language,
        "is_superuser": current_user.is_superuser,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
        "avatar_url": current_user.avatar_url,
    }


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.auth_service import verify_password
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect")

    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 8 caractères")

    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()
    return {"message": "Mot de passe modifié avec succès"}


@router.post("/setup-2fa")
async def setup_two_factor(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    secret = generate_totp_secret()
    current_user.two_factor_secret = secret
    await db.commit()
    return {
        "secret": secret,
        "otpauth_url": get_totp_uri(secret, current_user.username),
        "message": "Scannez le QR code avec votre application d'authentification",
    }


@router.post("/verify-2fa")
async def verify_two_factor(
    token: str = Body(..., embed=True),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.two_factor_secret:
        raise HTTPException(status_code=400, detail="2FA non configuré")
    if not verify_totp(current_user.two_factor_secret, token):
        raise HTTPException(status_code=400, detail="Code invalide")
    current_user.two_factor_enabled = True
    await db.commit()
    return {"message": "Authentification à deux facteurs activée"}


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    logger.info("User logged out", user_id=str(current_user.id))
    return {"message": "Déconnexion réussie"}
