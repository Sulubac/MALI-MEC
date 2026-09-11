from sqlalchemy import (
    Column, String, Boolean, DateTime, Enum, Text, Integer,
    ForeignKey, Table, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    NATIONAL_ARCHIVIST = "national_archivist"
    MINISTRY_ADMIN = "ministry_admin"
    ARCHIVIST = "archivist"
    VALIDATOR = "validator"
    DIGITIZER = "digitizer"
    READER = "reader"
    CITIZEN = "citizen"
    API_CLIENT = "api_client"


class ConfidentialityLevel(str, enum.Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    SECRET = "secret"
    TOP_SECRET = "top_secret"


user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True),
)

user_permissions = Table(
    "user_permissions",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
    Column("permission_id", UUID(as_uuid=True), ForeignKey("permissions.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    full_name_ar = Column(String(255))
    hashed_password = Column(String(255), nullable=False)
    phone = Column(String(20))
    employee_id = Column(String(50), unique=True)
    position = Column(String(255))
    department = Column(String(255))

    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id"))
    primary_role = Column(Enum(UserRole), default=UserRole.READER, nullable=False)
    confidentiality_level = Column(Enum(ConfidentialityLevel), default=ConfidentialityLevel.INTERNAL)

    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(32))

    preferred_language = Column(String(10), default="fr")
    avatar_url = Column(String(500))
    bio = Column(Text)
    preferences = Column(JSON, default={})

    last_login = Column(DateTime(timezone=True))
    last_login_ip = Column(String(45))
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    institution = relationship("Institution", back_populates="users")
    roles = relationship("Role", secondary=user_roles, back_populates="users")
    permissions = relationship("Permission", secondary=user_permissions, back_populates="users")
    audit_logs = relationship("AuditLog", back_populates="user", foreign_keys="AuditLog.user_id")
    sessions = relationship("UserSession", back_populates="user")


class Role(Base):
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    name_ar = Column(String(100))
    description = Column(Text)
    is_system = Column(Boolean, default=False)
    permissions_data = Column(JSON, default=[])
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", secondary=user_roles, back_populates="roles")


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(100), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    resource = Column(String(100))
    action = Column(String(50))
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", secondary=user_permissions, back_populates="permissions")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), nullable=False, index=True)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    device_info = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_used = Column(DateTime(timezone=True))

    user = relationship("User", back_populates="sessions")
