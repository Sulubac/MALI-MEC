from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text, Integer, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class InstitutionType(str, enum.Enum):
    PRESIDENCE = "presidence"
    PRIMATURE = "primature"
    SGG = "sgg"
    MINISTERE = "ministere"
    SECRETARIAT_ETAT = "secretariat_etat"
    DIRECTION = "direction"
    SERVICE = "service"
    ETABLISSEMENT_PUBLIC = "etablissement_public"
    COLLECTIVITE = "collectivite"
    AMBASSADE = "ambassade"
    ORGANISME = "organisme"


class InstitutionStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    MERGED = "merged"


class Institution(Base):
    __tablename__ = "institutions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(500), nullable=False)
    name_ar = Column(String(500))
    name_en = Column(String(500))
    acronym = Column(String(20))
    type = Column(Enum(InstitutionType), nullable=False)
    status = Column(Enum(InstitutionStatus), default=InstitutionStatus.ACTIVE)

    parent_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id"))
    level = Column(Integer, default=1)
    hierarchy_path = Column(String(1000))

    address = Column(Text)
    city = Column(String(100), default="Djibouti")
    region = Column(String(100))
    phone = Column(String(20))
    email = Column(String(255))
    website = Column(String(500))
    logo_url = Column(String(500))

    latitude = Column(Float)
    longitude = Column(Float)
    gps_coordinates = Column(String(100))

    minister_name = Column(String(255))
    director_name = Column(String(255))
    archivist_name = Column(String(255))

    document_count = Column(Integer, default=0)
    storage_used_gb = Column(Float, default=0.0)
    storage_quota_gb = Column(Float, default=100.0)

    settings = Column(JSON, default={})
    classification_plan_id = Column(UUID(as_uuid=True), ForeignKey("classification_plans.id"))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True))

    parent = relationship("Institution", remote_side="Institution.id", back_populates="children")
    children = relationship("Institution", back_populates="parent")
    users = relationship("User", back_populates="institution")
    documents = relationship("Document", back_populates="institution")
    classification_plan = relationship("ClassificationPlan", back_populates="institutions")
    physical_locations = relationship("PhysicalLocation", back_populates="institution")
