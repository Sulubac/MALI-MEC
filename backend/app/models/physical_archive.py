from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, ForeignKey, JSON, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class PhysicalLocation(Base):
    __tablename__ = "physical_locations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id"), nullable=False)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    type = Column(String(50))
    address = Column(Text)
    city = Column(String(100))
    latitude = Column(Float)
    longitude = Column(Float)
    capacity_boxes = Column(Integer)
    current_boxes = Column(Integer, default=0)
    floor_count = Column(Integer)
    is_climate_controlled = Column(Boolean, default=False)
    temperature_min = Column(Float)
    temperature_max = Column(Float)
    humidity_min = Column(Float)
    humidity_max = Column(Float)
    has_fire_suppression = Column(Boolean, default=False)
    has_security_cameras = Column(Boolean, default=False)
    rfid_enabled = Column(Boolean, default=False)
    manager_name = Column(String(255))
    phone = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    institution = relationship("Institution", back_populates="physical_locations")
    rooms = relationship("PhysicalRoom", back_populates="location")


class PhysicalRoom(Base):
    __tablename__ = "physical_rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id = Column(UUID(as_uuid=True), ForeignKey("physical_locations.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    floor = Column(Integer)
    capacity_shelves = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    location = relationship("PhysicalLocation", back_populates="rooms")
    shelves = relationship("PhysicalShelf", back_populates="room")


class PhysicalShelf(Base):
    __tablename__ = "physical_shelves"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("physical_rooms.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(50), nullable=False)
    row_number = Column(Integer)
    column_number = Column(Integer)
    level_number = Column(Integer)
    capacity_boxes = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    room = relationship("PhysicalRoom", back_populates="shelves")
    boxes = relationship("PhysicalBox", back_populates="shelf")


class PhysicalBox(Base):
    __tablename__ = "physical_boxes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shelf_id = Column(UUID(as_uuid=True), ForeignKey("physical_shelves.id"))
    barcode = Column(String(100), unique=True, nullable=False, index=True)
    qr_code = Column(Text)
    rfid_tag = Column(String(100), unique=True, index=True)
    label = Column(String(255))
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id"))
    date_start = Column(DateTime(timezone=True))
    date_end = Column(DateTime(timezone=True))
    document_count = Column(Integer, default=0)
    status = Column(String(50), default="in_place")
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    shelf = relationship("PhysicalShelf", back_populates="boxes")
    documents = relationship("Document", back_populates="physical_box")
    borrows = relationship("BoxBorrow", back_populates="box")


class BoxBorrow(Base):
    __tablename__ = "box_borrows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    box_id = Column(UUID(as_uuid=True), ForeignKey("physical_boxes.id"), nullable=False)
    borrowed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    borrower_name = Column(String(255))
    borrower_institution = Column(String(255))
    purpose = Column(Text)
    borrowed_at = Column(DateTime(timezone=True), server_default=func.now())
    expected_return = Column(DateTime(timezone=True))
    returned_at = Column(DateTime(timezone=True))
    status = Column(String(50), default="borrowed")
    notes = Column(Text)

    box = relationship("PhysicalBox", back_populates="borrows")
