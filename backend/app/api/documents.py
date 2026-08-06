import uuid
import hashlib
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File, Form,
    Query, BackgroundTasks, status
)
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, update
from pydantic import BaseModel
import structlog
import io

from app.database import get_db
from app.models.document import Document, DocumentType, DocumentStatus, ConfidentialityLevel, Tag, AccessRequest
from app.models.user import User
from app.models.audit import AuditLog
from app.api.auth import get_current_active_user
from app.services.storage_service import storage_service
from app.services.ocr_service import ocr_service
from app.services.ai_service import ai_service
from app.services.search_service import search_service
from app.config import settings

router = APIRouter(prefix="/documents", tags=["Documents"])
logger = structlog.get_logger()


class DocumentCreate(BaseModel):
    title: str
    title_ar: Optional[str] = None
    description: Optional[str] = None
    type: DocumentType
    confidentiality: ConfidentialityLevel = ConfidentialityLevel.INTERNAL
    institution_id: str
    classification_node_id: Optional[str] = None
    document_date: Optional[datetime] = None
    document_number: Optional[str] = None
    author: Optional[str] = None
    recipient: Optional[str] = None
    notes: Optional[str] = None
    keywords: Optional[List[str]] = []
    retention_category: Optional[str] = "permanent"


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    title_ar: Optional[str] = None
    description: Optional[str] = None
    type: Optional[DocumentType] = None
    confidentiality: Optional[ConfidentialityLevel] = None
    classification_node_id: Optional[str] = None
    document_date: Optional[datetime] = None
    author: Optional[str] = None
    recipient: Optional[str] = None
    notes: Optional[str] = None
    keywords: Optional[List[str]] = None
    status: Optional[DocumentStatus] = None


def generate_reference(doc_type: str, institution_code: str = "DJ") -> str:
    year = datetime.now().year
    rand = uuid.uuid4().hex[:6].upper()
    type_code = doc_type[:3].upper()
    return f"{institution_code}/{type_code}/{year}/{rand}"


async def log_action(
    db: AsyncSession,
    user: User,
    action: str,
    resource_type: str,
    resource_id: str,
    details: Dict = None,
):
    log = AuditLog(
        user_id=user.id,
        username=user.username,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata=details or {},
    )
    db.add(log)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_document(
    data: DocumentCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    inst_id = uuid.UUID(data.institution_id)
    reference = generate_reference(data.type.value)

    doc = Document(
        reference=reference,
        title=data.title,
        title_ar=data.title_ar,
        description=data.description,
        type=data.type,
        status=DocumentStatus.RECEIVED,
        confidentiality=data.confidentiality,
        institution_id=inst_id,
        document_date=data.document_date,
        document_number=data.document_number,
        author=data.author,
        recipient=data.recipient,
        notes=data.notes,
        keywords=data.keywords or [],
        retention_category=data.retention_category,
        created_by=current_user.id,
        is_born_digital=True,
    )

    if data.classification_node_id:
        try:
            doc.classification_node_id = uuid.UUID(data.classification_node_id)
        except ValueError:
            pass

    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    background_tasks.add_task(log_action, db, current_user, "create", "document", str(doc.id))
    background_tasks.add_task(search_service.index_document, str(doc.id), {
        "title": doc.title,
        "type": doc.type.value,
        "institution_id": str(doc.institution_id),
        "document_date": doc.document_date.isoformat() if doc.document_date else None,
        "confidentiality": doc.confidentiality.value,
        "status": doc.status.value,
        "keywords": doc.keywords,
        "author": doc.author,
    })

    logger.info("Document created", doc_id=str(doc.id), reference=reference)
    return _format_document(doc)


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    document_type: str = Form(...),
    institution_id: str = Form(...),
    confidentiality: str = Form(default="internal"),
    description: str = Form(default=""),
    run_ocr: bool = Form(default=True),
    run_ai: bool = Form(default=True),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if file.size and file.size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Fichier trop volumineux (max {settings.MAX_UPLOAD_SIZE_MB}MB)")

    content = await file.read()
    file_hash = hashlib.sha256(content).hexdigest()

    existing = await db.execute(select(Document).where(Document.file_hash == file_hash))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Ce document existe déjà dans le système (doublon détecté)")

    try:
        upload_result = await storage_service.upload_file(
            content, file.filename, "documents",
            file.content_type or "application/octet-stream",
            institution_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur de stockage: {str(e)}")

    try:
        inst_id = uuid.UUID(institution_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID institution invalide")

    reference = generate_reference(document_type)
    doc = Document(
        reference=reference,
        title=title,
        description=description,
        type=DocumentType(document_type) if document_type in [t.value for t in DocumentType] else DocumentType.AUTRE,
        status=DocumentStatus.DIGITIZING if not run_ocr else DocumentStatus.OCR_PROCESSING,
        confidentiality=ConfidentialityLevel(confidentiality) if confidentiality in [c.value for c in ConfidentialityLevel] else ConfidentialityLevel.INTERNAL,
        institution_id=inst_id,
        file_path=upload_result["path"],
        file_size=upload_result["size"],
        file_hash=upload_result["hash_sha256"],
        checksum_md5=upload_result["hash_md5"],
        checksum_sha256=upload_result["hash_sha256"],
        file_format=file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "",
        mime_type=file.content_type,
        reception_date=datetime.utcnow(),
        created_by=current_user.id,
        is_digitized=True,
    )

    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    if run_ocr:
        background_tasks.add_task(_process_document_async, str(doc.id), upload_result["path"], run_ai)

    logger.info("Document uploaded", doc_id=str(doc.id), filename=file.filename)
    return {
        **_format_document(doc),
        "message": "Document téléchargé avec succès. Traitement en cours.",
        "ocr_queued": run_ocr,
    }


async def _process_document_async(doc_id: str, file_path: str, run_ai: bool):
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
            doc = result.scalar_one_or_none()
            if not doc:
                return

            content = await storage_service.download_file(file_path)
            if not content:
                return

            import tempfile
            import os
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{doc.file_format or 'pdf'}") as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                ocr_result = await ocr_service.process_file(tmp_path)
                doc.content_text = ocr_result.text
                doc.ocr_confidence = ocr_result.confidence
                doc.ocr_language = ocr_result.language
                doc.is_ocr_processed = True
                doc.status = DocumentStatus.AI_ANALYSIS if run_ai else DocumentStatus.INDEXING

                if run_ai and ocr_result.text:
                    analysis = await ai_service.analyze_document(ocr_result.text)
                    if not doc.title or doc.title == "Document sans titre":
                        doc.title = analysis.title
                    doc.content_summary = analysis.summary
                    doc.keywords = analysis.keywords
                    doc.entities_persons = analysis.entities_persons
                    doc.entities_organizations = analysis.entities_organizations
                    doc.entities_locations = analysis.entities_locations
                    doc.ai_classification_confidence = analysis.confidence
                    doc.is_ai_analyzed = True
                    doc.status = DocumentStatus.VALIDATION

                doc.is_indexed = True
                await db.commit()

                await search_service.index_document(doc_id, {
                    "title": doc.title,
                    "content_text": doc.content_text or "",
                    "type": doc.type.value,
                    "institution_id": str(doc.institution_id),
                    "document_date": doc.document_date.isoformat() if doc.document_date else None,
                    "confidentiality": doc.confidentiality.value,
                    "status": doc.status.value,
                    "keywords": doc.keywords,
                    "author": doc.author or "",
                    "entities_persons": doc.entities_persons,
                    "entities_organizations": doc.entities_organizations,
                })
            finally:
                os.unlink(tmp_path)

        except Exception as e:
            logger.error("Background processing failed", doc_id=doc_id, error=str(e))


@router.get("/")
async def list_documents(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    institution_id: Optional[str] = None,
    document_type: Optional[str] = None,
    status: Optional[str] = None,
    confidentiality: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Document)
    filters = []

    if institution_id:
        try:
            filters.append(Document.institution_id == uuid.UUID(institution_id))
        except ValueError:
            pass
    if document_type:
        filters.append(Document.type == document_type)
    if status:
        filters.append(Document.status == status)
    if confidentiality:
        filters.append(Document.confidentiality == confidentiality)
    if date_from:
        filters.append(Document.document_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        filters.append(Document.document_date <= datetime.combine(date_to, datetime.max.time()))
    if search:
        filters.append(or_(
            Document.title.ilike(f"%{search}%"),
            Document.reference.ilike(f"%{search}%"),
            Document.author.ilike(f"%{search}%"),
        ))

    if filters:
        query = query.where(and_(*filters))

    count_q = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar()

    query = query.offset((page - 1) * size).limit(size).order_by(Document.created_at.desc())
    result = await db.execute(query)
    documents = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size,
        "items": [_format_document(d) for d in documents],
    }


@router.get("/{doc_id}")
async def get_document(
    doc_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(Document).where(Document.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    doc.view_count = (doc.view_count or 0) + 1
    doc.last_accessed = datetime.utcnow()
    await db.commit()

    return _format_document(doc, detailed=True)


@router.patch("/{doc_id}")
async def update_document(
    doc_id: str,
    data: DocumentUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(Document).where(Document.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field == "classification_node_id" and value:
            try:
                value = uuid.UUID(value)
            except ValueError:
                continue
        setattr(doc, field, value)

    doc.updated_by = current_user.id
    doc.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(doc)

    background_tasks.add_task(log_action, db, current_user, "update", "document", doc_id)
    return _format_document(doc)


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(Document).where(Document.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    if doc.file_path:
        await storage_service.delete_file(doc.file_path)

    await search_service.delete_document(doc_id)
    await db.delete(doc)
    await db.commit()

    logger.info("Document deleted", doc_id=doc_id, user=current_user.username)
    return {"message": "Document supprimé avec succès"}


@router.post("/{doc_id}/process-ocr")
async def trigger_ocr(
    doc_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(Document).where(Document.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    if not doc.file_path:
        raise HTTPException(status_code=400, detail="Aucun fichier associé à ce document")

    doc.status = DocumentStatus.OCR_PROCESSING
    await db.commit()

    background_tasks.add_task(_process_document_async, doc_id, doc.file_path, True)
    return {"message": "Traitement OCR lancé", "doc_id": doc_id}


@router.post("/{doc_id}/validate")
async def validate_document(
    doc_id: str,
    decision: str = Form(...),
    notes: str = Form(default=""),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(Document).where(Document.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    if decision == "approve":
        doc.status = DocumentStatus.ARCHIVED
        doc.archiving_date = datetime.utcnow()
    elif decision == "reject":
        doc.status = DocumentStatus.DRAFT
    else:
        raise HTTPException(status_code=400, detail="Décision invalide (approve/reject)")

    if notes:
        existing_notes = doc.processing_notes or []
        existing_notes.append({
            "action": decision,
            "notes": notes,
            "by": current_user.username,
            "at": datetime.utcnow().isoformat(),
        })
        doc.processing_notes = existing_notes

    doc.updated_by = current_user.id
    await db.commit()
    return {"message": f"Document {'validé' if decision == 'approve' else 'rejeté'}", "status": doc.status}


@router.get("/{doc_id}/download")
async def download_document(
    doc_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(Document).where(Document.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    if not doc.file_path:
        raise HTTPException(status_code=404, detail="Aucun fichier associé")

    content = await storage_service.download_file(doc.file_path)
    if not content:
        raise HTTPException(status_code=404, detail="Fichier non trouvé dans le stockage")

    doc.download_count = (doc.download_count or 0) + 1
    await db.commit()

    filename = f"{doc.reference}.{doc.file_format or 'pdf'}"
    return StreamingResponse(
        io.BytesIO(content),
        media_type=doc.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/stats/summary")
async def get_document_stats(
    institution_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    base_filter = []
    if institution_id:
        try:
            base_filter.append(Document.institution_id == uuid.UUID(institution_id))
        except ValueError:
            pass

    total = await db.execute(select(func.count(Document.id)).where(*base_filter if base_filter else [True]))
    total_count = total.scalar()

    by_status = {}
    for s in DocumentStatus:
        count = await db.execute(
            select(func.count(Document.id)).where(
                Document.status == s, *base_filter if base_filter else [True]
            )
        )
        by_status[s.value] = count.scalar()

    by_type = {}
    for t in DocumentType:
        count = await db.execute(
            select(func.count(Document.id)).where(
                Document.type == t, *base_filter if base_filter else [True]
            )
        )
        c = count.scalar()
        if c > 0:
            by_type[t.value] = c

    size_result = await db.execute(
        select(func.sum(Document.file_size)).where(*base_filter if base_filter else [True])
    )
    total_size = size_result.scalar() or 0

    return {
        "total_documents": total_count,
        "total_size_bytes": total_size,
        "total_size_gb": round(total_size / (1024**3), 2),
        "by_status": by_status,
        "by_type": by_type,
    }


def _format_document(doc: Document, detailed: bool = False) -> dict:
    base = {
        "id": str(doc.id),
        "reference": doc.reference,
        "title": doc.title,
        "title_ar": doc.title_ar,
        "type": doc.type.value if doc.type else None,
        "status": doc.status.value if doc.status else None,
        "confidentiality": doc.confidentiality.value if doc.confidentiality else None,
        "institution_id": str(doc.institution_id) if doc.institution_id else None,
        "document_date": doc.document_date.isoformat() if doc.document_date else None,
        "document_number": doc.document_number,
        "author": doc.author,
        "recipient": doc.recipient,
        "file_size": doc.file_size,
        "file_format": doc.file_format,
        "page_count": doc.page_count,
        "is_digitized": doc.is_digitized,
        "is_ocr_processed": doc.is_ocr_processed,
        "is_ai_analyzed": doc.is_ai_analyzed,
        "ocr_confidence": doc.ocr_confidence,
        "keywords": doc.keywords or [],
        "view_count": doc.view_count,
        "download_count": doc.download_count,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }
    if detailed:
        base.update({
            "description": doc.description,
            "content_summary": doc.content_summary,
            "entities_persons": doc.entities_persons or [],
            "entities_organizations": doc.entities_organizations or [],
            "entities_locations": doc.entities_locations or [],
            "metadata_dc": doc.metadata_dc or {},
            "processing_notes": doc.processing_notes or [],
            "checksum_sha256": doc.checksum_sha256,
            "blockchain_hash": doc.blockchain_hash,
            "retention_category": doc.retention_category,
            "retention_until": doc.retention_until.isoformat() if doc.retention_until else None,
            "archiving_date": doc.archiving_date.isoformat() if doc.archiving_date else None,
        })
    return base
