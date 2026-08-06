from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base


class ClassificationPlan(Base):
    __tablename__ = "classification_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(500), nullable=False)
    name_ar = Column(String(500))
    description = Column(Text)
    version = Column(String(20), default="1.0")
    is_national = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    effective_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True))

    nodes = relationship("ClassificationNode", back_populates="plan")
    institutions = relationship("Institution", back_populates="classification_plan")


class ClassificationNode(Base):
    __tablename__ = "classification_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("classification_plans.id"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("classification_nodes.id"))
    code = Column(String(50), nullable=False, index=True)
    full_code = Column(String(200), index=True)
    name = Column(String(500), nullable=False)
    name_ar = Column(String(500))
    description = Column(Text)
    level = Column(Integer, default=1)
    level_name = Column(String(100))
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_leaf = Column(Boolean, default=False)
    retention_years = Column(Integer)
    retention_category = Column(String(50))
    confidentiality_default = Column(String(50), default="internal")
    metadata_schema = Column(JSON, default={})
    document_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plan = relationship("ClassificationPlan", back_populates="nodes")
    parent = relationship("ClassificationNode", remote_side="ClassificationNode.id", back_populates="children")
    children = relationship("ClassificationNode", back_populates="parent")
    documents = relationship("Document", back_populates="classification_node")
