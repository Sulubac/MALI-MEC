from sqlalchemy import (
    Column, String, Boolean, DateTime, Enum, Text, Integer,
    ForeignKey, JSON, Float, LargeBinary, BigInteger, Table
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class DocumentType(str, enum.Enum):
    COURRIER_ENTRANT = "courrier_entrant"
    COURRIER_SORTANT = "courrier_sortant"
    DECISION = "decision"
    DECRET = "decret"
    ARRETE = "arrete"
    LOI = "loi"
    ORDONNANCE = "ordonnance"
    CIRCULAIRE = "circulaire"
    NOTE = "note"
    RAPPORT = "rapport"
    CONTRAT = "contrat"
    CONVENTION = "convention"
    PROTOCOLE = "protocole"
    PLAN = "plan"
    BUDGET = "budget"
    COMPTE_RENDU = "compte_rendu"
    PROCES_VERBAL = "proces_verbal"
    PHOTO = "photo"
    VIDEO = "video"
    AUDIO = "audio"
    EMAIL = "email"
    FORMULAIRE = "formulaire"
    CARTE = "carte"
    CAD = "cad"
    SIG = "sig"
    AUTRE = "autre"


class DocumentStatus(str, enum.Enum):
    DRAFT = "draft"
    RECEIVED = "received"
    DIGITIZING = "digitizing"
    OCR_PROCESSING = "ocr_processing"
    AI_ANALYSIS = "ai_analysis"
    VALIDATION = "validation"
    QUALITY_CONTROL = "quality_control"
    INDEXING = "indexing"
    ARCHIVED = "archived"
    PUBLISHED = "published"
    RESTRICTED = "restricted"
    DESTROYED = "destroyed"
    TRANSFERRED = "transferred"


class ConfidentialityLevel(str, enum.Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    SECRET = "secret"
    TOP_SECRET = "top_secret"


class RetentionCategory(str, enum.Enum):
    PERMANENT = "permanent"
    YEARS_1 = "1_year"
    YEARS_5 = "5_years"
    YEARS_10 = "10_years"
    YEARS_30 = "30_years"
    YEARS_50 = "50_years"
    YEARS_100 = "100_years"
    ELIMINATION = "elimination"


document_tags = Table(
    "document_tags",
    Base.metadata,
    Column("document_id", UUID(as_uuid=True), ForeignKey("documents.id"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("tags.id"), primary_key=True),
)


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference = Column(String(100), unique=True, nullable=False, index=True)
    barcode = Column(String(100), unique=True, index=True)
    qr_code = Column(Text)

    title = Column(String(1000), nullable=False)
    title_ar = Column(String(1000))
    title_en = Column(String(1000))
    description = Column(Text)
    content_text = Column(Text)
    content_summary = Column(Text)
    content_summary_ar = Column(Text)

    type = Column(Enum(DocumentType), nullable=False)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.RECEIVED)
    confidentiality = Column(Enum(ConfidentialityLevel), default=ConfidentialityLevel.INTERNAL)
    retention_category = Column(Enum(RetentionCategory), default=RetentionCategory.PERMANENT)

    document_date = Column(DateTime(timezone=True))
    document_year = Column(Integer)
    document_number = Column(String(100))
    document_reference = Column(String(200))

    reception_date = Column(DateTime(timezone=True))
    archiving_date = Column(DateTime(timezone=True))
    destruction_date = Column(DateTime(timezone=True))
    retention_until = Column(DateTime(timezone=True))

    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id"), nullable=False)
    classification_node_id = Column(UUID(as_uuid=True), ForeignKey("classification_nodes.id"))
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflow_instances.id"))
    physical_box_id = Column(UUID(as_uuid=True), ForeignKey("physical_boxes.id"))

    author = Column(String(500))
    author_institution = Column(String(500))
    recipient = Column(String(500))
    recipient_institution = Column(String(500))
    signatories = Column(JSON, default=[])

    file_path = Column(String(1000))
    file_size = Column(BigInteger)
    file_hash = Column(String(64))
    file_format = Column(String(50))
    mime_type = Column(String(100))
    page_count = Column(Integer)
    thumbnail_path = Column(String(500))

    is_digitized = Column(Boolean, default=False)
    is_ocr_processed = Column(Boolean, default=False)
    is_ai_analyzed = Column(Boolean, default=False)
    is_indexed = Column(Boolean, default=False)
    is_duplicate = Column(Boolean, default=False)
    is_born_digital = Column(Boolean, default=False)

    ocr_confidence = Column(Float)
    ocr_language = Column(String(20))
    ai_classification_confidence = Column(Float)

    metadata_dc = Column(JSON, default={})
    metadata_premis = Column(JSON, default={})
    metadata_mets = Column(JSON, default={})
    metadata_custom = Column(JSON, default={})

    keywords = Column(JSON, default=[])
    entities_persons = Column(JSON, default=[])
    entities_organizations = Column(JSON, default=[])
    entities_locations = Column(JSON, default=[])
    entities_dates = Column(JSON, default=[])
    relations = Column(JSON, default=[])

    embedding_vector = Column(JSON)
    search_vector = Column(Text)

    view_count = Column(Integer, default=0)
    download_count = Column(Integer, default=0)
    last_accessed = Column(DateTime(timezone=True))

    version = Column(Integer, default=1)
    is_current_version = Column(Boolean, default=True)
    parent_document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"))

    checksum_md5 = Column(String(32))
    checksum_sha256 = Column(String(64))
    blockchain_hash = Column(String(255))
    timestamp_token = Column(Text)
    electronic_signature = Column(Text)

    notes = Column(Text)
    processing_notes = Column(JSON, default=[])

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    updated_by = Column(UUID(as_uuid=True))

    institution = relationship("Institution", back_populates="documents")
    classification_node = relationship("ClassificationNode", back_populates="documents")
    tags = relationship("Tag", secondary=document_tags, back_populates="documents")
    versions = relationship("Document", foreign_keys=[parent_document_id])
    attachments = relationship("DocumentAttachment", back_populates="document")
    access_logs = relationship("DocumentAccess", back_populates="document")
    workflow_instance = relationship("WorkflowInstance", back_populates="document")


class DocumentAttachment(Base):
    __tablename__ = "document_attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(BigInteger)
    mime_type = Column(String(100))
    file_hash = Column(String(64))
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True))

    document = relationship("Document", back_populates="attachments")


class DocumentAccess(Base):
    __tablename__ = "document_accesses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    access_type = Column(String(50))
    ip_address = Column(String(45))
    accessed_at = Column(DateTime(timezone=True), server_default=func.now())
    duration_seconds = Column(Integer)

    document = relationship("Document", back_populates="access_logs")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), unique=True, nullable=False)
    name_ar = Column(String(200))
    color = Column(String(7))
    category = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    documents = relationship("Document", secondary=document_tags, back_populates="tags")


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"))
    requester_name = Column(String(255), nullable=False)
    requester_email = Column(String(255), nullable=False)
    requester_phone = Column(String(20))
    requester_institution = Column(String(500))
    requester_id_number = Column(String(50))
    purpose = Column(Text, nullable=False)
    status = Column(String(50), default="pending")
    decision_notes = Column(Text)
    decided_by = Column(UUID(as_uuid=True))
    decided_at = Column(DateTime(timezone=True))
    access_until = Column(DateTime(timezone=True))
    fee_amount = Column(Float)
    fee_paid = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
