import uuid
import qrcode
import io
import base64
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
import structlog

from app.database import get_db
from app.models.physical_archive import PhysicalLocation, PhysicalRoom, PhysicalShelf, PhysicalBox, BoxBorrow
from app.models.user import User
from app.api.auth import get_current_active_user

router = APIRouter(prefix="/physical", tags=["Archives Physiques"])
logger = structlog.get_logger()


class LocationCreate(BaseModel):
    institution_id: str
    name: str
    code: str
    type: str = "depot"
    address: Optional[str] = None
    city: str = "Djibouti"
    capacity_boxes: Optional[int] = None
    is_climate_controlled: bool = False
    has_fire_suppression: bool = False
    has_security_cameras: bool = False
    rfid_enabled: bool = False
    manager_name: Optional[str] = None
    phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class BoxCreate(BaseModel):
    shelf_id: Optional[str] = None
    barcode: str
    label: Optional[str] = None
    institution_id: str
    notes: Optional[str] = None


class BorrowCreate(BaseModel):
    box_id: str
    borrower_name: str
    borrower_institution: str
    purpose: str
    expected_return: Optional[str] = None


@router.post("/locations", status_code=status.HTTP_201_CREATED)
async def create_location(
    data: LocationCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(PhysicalLocation).where(PhysicalLocation.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Code dépôt '{data.code}' déjà utilisé")

    location = PhysicalLocation(
        institution_id=uuid.UUID(data.institution_id),
        name=data.name,
        code=data.code,
        type=data.type,
        address=data.address,
        city=data.city,
        capacity_boxes=data.capacity_boxes,
        is_climate_controlled=data.is_climate_controlled,
        has_fire_suppression=data.has_fire_suppression,
        has_security_cameras=data.has_security_cameras,
        rfid_enabled=data.rfid_enabled,
        manager_name=data.manager_name,
        phone=data.phone,
        latitude=data.latitude,
        longitude=data.longitude,
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return _format_location(location)


@router.get("/locations")
async def list_locations(
    institution_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(PhysicalLocation)
    if institution_id:
        try:
            query = query.where(PhysicalLocation.institution_id == uuid.UUID(institution_id))
        except ValueError:
            pass
    result = await db.execute(query.order_by(PhysicalLocation.name))
    locations = result.scalars().all()
    return {"items": [_format_location(l) for l in locations]}


@router.post("/boxes", status_code=status.HTTP_201_CREATED)
async def create_box(
    data: BoxCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(PhysicalBox).where(PhysicalBox.barcode == data.barcode)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Code barre '{data.barcode}' déjà utilisé")

    qr_data = f"PNGA-BOX:{data.barcode}"
    qr_img = qrcode.make(qr_data)
    buf = io.BytesIO()
    qr_img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    box = PhysicalBox(
        barcode=data.barcode,
        qr_code=qr_b64,
        label=data.label,
        institution_id=uuid.UUID(data.institution_id),
        notes=data.notes,
    )
    if data.shelf_id:
        try:
            box.shelf_id = uuid.UUID(data.shelf_id)
        except ValueError:
            pass

    db.add(box)
    await db.commit()
    await db.refresh(box)
    return _format_box(box)


@router.get("/boxes")
async def list_boxes(
    institution_id: Optional[str] = None,
    shelf_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import and_
    filters = []
    if institution_id:
        try:
            filters.append(PhysicalBox.institution_id == uuid.UUID(institution_id))
        except ValueError:
            pass
    if shelf_id:
        try:
            filters.append(PhysicalBox.shelf_id == uuid.UUID(shelf_id))
        except ValueError:
            pass
    if status:
        filters.append(PhysicalBox.status == status)

    query = select(PhysicalBox)
    if filters:
        query = query.where(and_(*filters))

    total_r = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_r.scalar()

    result = await db.execute(
        query.offset((page - 1) * size).limit(size).order_by(PhysicalBox.barcode)
    )
    boxes = result.scalars().all()
    return {
        "total": total,
        "page": page,
        "size": size,
        "items": [_format_box(b) for b in boxes],
    }


@router.get("/boxes/locate/{barcode}")
async def locate_box(
    barcode: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PhysicalBox).where(PhysicalBox.barcode == barcode)
    )
    box = result.scalar_one_or_none()
    if not box:
        raise HTTPException(status_code=404, detail=f"Boîte avec code barre '{barcode}' non trouvée")

    location_info = {}
    if box.shelf_id:
        shelf_r = await db.execute(select(PhysicalShelf).where(PhysicalShelf.id == box.shelf_id))
        shelf = shelf_r.scalar_one_or_none()
        if shelf:
            room_r = await db.execute(select(PhysicalRoom).where(PhysicalRoom.id == shelf.room_id))
            room = room_r.scalar_one_or_none()
            if room:
                loc_r = await db.execute(
                    select(PhysicalLocation).where(PhysicalLocation.id == room.location_id)
                )
                loc = loc_r.scalar_one_or_none()
                location_info = {
                    "depot": loc.name if loc else None,
                    "salle": room.name if room else None,
                    "etagere": shelf.name if shelf else None,
                    "rangee": shelf.row_number if shelf else None,
                    "colonne": shelf.column_number if shelf else None,
                    "niveau": shelf.level_number if shelf else None,
                }

    return {
        "barcode": barcode,
        "box": _format_box(box),
        "location": location_info,
    }


@router.post("/borrows", status_code=status.HTTP_201_CREATED)
async def borrow_box(
    data: BorrowCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    try:
        box_uuid = uuid.UUID(data.box_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID boîte invalide")

    result = await db.execute(select(PhysicalBox).where(PhysicalBox.id == box_uuid))
    box = result.scalar_one_or_none()
    if not box:
        raise HTTPException(status_code=404, detail="Boîte non trouvée")
    if box.status != "in_place":
        raise HTTPException(status_code=400, detail="Cette boîte est déjà empruntée")

    expected_return = None
    if data.expected_return:
        try:
            expected_return = datetime.fromisoformat(data.expected_return)
        except ValueError:
            pass

    borrow = BoxBorrow(
        box_id=box_uuid,
        borrowed_by=current_user.id,
        borrower_name=data.borrower_name,
        borrower_institution=data.borrower_institution,
        purpose=data.purpose,
        expected_return=expected_return,
        status="borrowed",
    )
    box.status = "borrowed"
    db.add(borrow)
    await db.commit()
    await db.refresh(borrow)
    return {"message": "Emprunt enregistré", "borrow_id": str(borrow.id)}


@router.post("/borrows/{borrow_id}/return")
async def return_box(
    borrow_id: str,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    try:
        b_uuid = uuid.UUID(borrow_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(BoxBorrow).where(BoxBorrow.id == b_uuid))
    borrow = result.scalar_one_or_none()
    if not borrow:
        raise HTTPException(status_code=404, detail="Emprunt non trouvé")

    borrow.returned_at = datetime.utcnow()
    borrow.status = "returned"
    if notes:
        borrow.notes = notes

    box_result = await db.execute(select(PhysicalBox).where(PhysicalBox.id == borrow.box_id))
    box = box_result.scalar_one_or_none()
    if box:
        box.status = "in_place"

    await db.commit()
    return {"message": "Retour enregistré avec succès"}


def _format_location(l: PhysicalLocation) -> dict:
    return {
        "id": str(l.id),
        "institution_id": str(l.institution_id),
        "name": l.name,
        "code": l.code,
        "type": l.type,
        "address": l.address,
        "city": l.city,
        "capacity_boxes": l.capacity_boxes,
        "current_boxes": l.current_boxes,
        "is_climate_controlled": l.is_climate_controlled,
        "has_fire_suppression": l.has_fire_suppression,
        "rfid_enabled": l.rfid_enabled,
        "latitude": l.latitude,
        "longitude": l.longitude,
        "manager_name": l.manager_name,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }


def _format_box(b: PhysicalBox) -> dict:
    return {
        "id": str(b.id),
        "barcode": b.barcode,
        "rfid_tag": b.rfid_tag,
        "label": b.label,
        "institution_id": str(b.institution_id) if b.institution_id else None,
        "shelf_id": str(b.shelf_id) if b.shelf_id else None,
        "document_count": b.document_count,
        "status": b.status,
        "notes": b.notes,
        "qr_code_available": b.qr_code is not None,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }
