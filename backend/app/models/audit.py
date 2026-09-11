from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    username = Column(String(100))
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)
    resource_id = Column(String(255), index=True)
    resource_name = Column(String(500))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id"))
    ip_address = Column(String(45))
    user_agent = Column(Text)
    device_type = Column(String(50))
    session_id = Column(String(255))
    request_method = Column(String(10))
    request_path = Column(String(500))
    status_code = Column(Integer)
    duration_ms = Column(Integer)
    before_state = Column(JSON)
    after_state = Column(JSON)
    changes = Column(JSON)
    error_message = Column(Text)
    extra_metadata = Column("metadata", JSON, default={})
    hash_chain = Column(String(64))
    is_sensitive = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs", foreign_keys=[user_id])


class SystemEvent(Base):
    __tablename__ = "system_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(100), nullable=False, index=True)
    severity = Column(String(20), default="info")
    source = Column(String(100))
    message = Column(Text, nullable=False)
    details = Column(JSON)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(UUID(as_uuid=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
