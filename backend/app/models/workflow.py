from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, JSON, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class WorkflowStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DRAFT = "draft"


class StepStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
    SKIPPED = "skipped"
    WAITING = "waiting"


class WorkflowDefinition(Base):
    __tablename__ = "workflow_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    name_ar = Column(String(255))
    code = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    document_types = Column(JSON, default=[])
    steps = Column(JSON, nullable=False, default=[])
    sla_hours = Column(Integer, default=72)
    is_default = Column(Boolean, default=False)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.ACTIVE)
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id"))
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True))

    instances = relationship("WorkflowInstance", back_populates="definition")


class WorkflowInstance(Base):
    __tablename__ = "workflow_instances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    definition_id = Column(UUID(as_uuid=True), ForeignKey("workflow_definitions.id"), nullable=False)
    current_step = Column(String(100))
    current_step_index = Column(Integer, default=0)
    status = Column(String(50), default="in_progress")
    priority = Column(String(20), default="normal")
    sla_deadline = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    definition = relationship("WorkflowDefinition", back_populates="instances")
    document = relationship("Document", back_populates="workflow_instance")
    steps = relationship("WorkflowStep", back_populates="workflow_instance")


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_instance_id = Column(UUID(as_uuid=True), ForeignKey("workflow_instances.id"), nullable=False)
    step_code = Column(String(100), nullable=False)
    step_name = Column(String(255), nullable=False)
    step_order = Column(Integer, nullable=False)
    status = Column(Enum(StepStatus), default=StepStatus.PENDING)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    assigned_role = Column(String(100))
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    sla_hours = Column(Integer)
    sla_deadline = Column(DateTime(timezone=True))
    duration_minutes = Column(Integer)
    is_overdue = Column(Boolean, default=False)
    decision = Column(String(50))
    decision_notes = Column(Text)
    attachments = Column(JSON, default=[])
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workflow_instance = relationship("WorkflowInstance", back_populates="steps")
    assigned_user = relationship("User", foreign_keys=[assigned_to])
