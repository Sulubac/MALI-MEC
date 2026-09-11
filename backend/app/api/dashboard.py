from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
import structlog

from app.database import get_db
from app.models.document import Document, DocumentStatus, DocumentType
from app.models.institution import Institution
from app.models.user import User
from app.models.audit import AuditLog
from app.api.auth import get_current_active_user

router = APIRouter(prefix="/dashboard", tags=["Tableau de bord"])
logger = structlog.get_logger()


@router.get("/kpis")
async def get_national_kpis(
    institution_id: Optional[str] = None,
    period_days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    import uuid
    period_start = datetime.utcnow() - timedelta(days=period_days)

    filters = []
    if institution_id:
        try:
            filters.append(Document.institution_id == uuid.UUID(institution_id))
        except ValueError:
            pass

    total_docs = await db.execute(select(func.count(Document.id)).where(*filters if filters else [True]))
    total_size = await db.execute(select(func.sum(Document.file_size)).where(*filters if filters else [True]))
    archived_docs = await db.execute(
        select(func.count(Document.id)).where(
            Document.status == DocumentStatus.ARCHIVED,
            *filters if filters else [True]
        )
    )
    new_docs_period = await db.execute(
        select(func.count(Document.id)).where(
            Document.created_at >= period_start,
            *filters if filters else [True]
        )
    )
    ocr_processed = await db.execute(
        select(func.count(Document.id)).where(
            Document.is_ocr_processed == True,
            *filters if filters else [True]
        )
    )
    ai_analyzed = await db.execute(
        select(func.count(Document.id)).where(
            Document.is_ai_analyzed == True,
            *filters if filters else [True]
        )
    )
    avg_ocr_confidence = await db.execute(
        select(func.avg(Document.ocr_confidence)).where(
            Document.ocr_confidence != None,
            *filters if filters else [True]
        )
    )
    inst_count = await db.execute(select(func.count(Institution.id)))
    user_count = await db.execute(select(func.count(User.id)).where(User.is_active == True))

    total_docs_val = total_docs.scalar() or 0
    archived_val = archived_docs.scalar() or 0
    total_size_val = total_size.scalar() or 0

    by_type = {}
    for t in DocumentType:
        count = await db.execute(
            select(func.count(Document.id)).where(
                Document.type == t, *filters if filters else [True]
            )
        )
        c = count.scalar()
        if c > 0:
            by_type[t.value] = c

    by_status = {}
    for s in DocumentStatus:
        count = await db.execute(
            select(func.count(Document.id)).where(
                Document.status == s, *filters if filters else [True]
            )
        )
        by_status[s.value] = count.scalar() or 0

    monthly_trend = []
    for i in range(6):
        month_start = datetime.utcnow().replace(day=1) - timedelta(days=30 * i)
        month_end = month_start + timedelta(days=32)
        month_end = month_end.replace(day=1)
        count = await db.execute(
            select(func.count(Document.id)).where(
                Document.created_at >= month_start,
                Document.created_at < month_end,
            )
        )
        monthly_trend.append({
            "month": month_start.strftime("%Y-%m"),
            "count": count.scalar() or 0,
        })

    monthly_trend.reverse()

    return {
        "period_days": period_days,
        "generated_at": datetime.utcnow().isoformat(),
        "totals": {
            "documents": total_docs_val,
            "archived": archived_val,
            "institutions": inst_count.scalar() or 0,
            "active_users": user_count.scalar() or 0,
            "storage_bytes": total_size_val,
            "storage_tb": round(total_size_val / (1024**4), 4),
        },
        "period_stats": {
            "new_documents": new_docs_period.scalar() or 0,
            "period_label": f"Derniers {period_days} jours",
        },
        "quality": {
            "ocr_processed": ocr_processed.scalar() or 0,
            "ai_analyzed": ai_analyzed.scalar() or 0,
            "ocr_rate": round((ocr_processed.scalar() or 0) / max(total_docs_val, 1) * 100, 1),
            "avg_ocr_confidence": round((avg_ocr_confidence.scalar() or 0) * 100, 1),
            "archiving_rate": round(archived_val / max(total_docs_val, 1) * 100, 1),
        },
        "by_type": by_type,
        "by_status": by_status,
        "monthly_trend": monthly_trend,
    }


@router.get("/top-institutions")
async def get_top_institutions(
    limit: int = Query(10, ge=1, le=50),
    metric: str = Query("documents", description="documents | storage | users"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    if metric == "documents":
        result = await db.execute(
            select(
                Institution.id, Institution.name, Institution.code,
                func.count(Document.id).label("value")
            )
            .join(Document, Document.institution_id == Institution.id, isouter=True)
            .group_by(Institution.id, Institution.name, Institution.code)
            .order_by(func.count(Document.id).desc())
            .limit(limit)
        )
    elif metric == "storage":
        result = await db.execute(
            select(
                Institution.id, Institution.name, Institution.code,
                func.coalesce(func.sum(Document.file_size), 0).label("value")
            )
            .join(Document, Document.institution_id == Institution.id, isouter=True)
            .group_by(Institution.id, Institution.name, Institution.code)
            .order_by(func.coalesce(func.sum(Document.file_size), 0).desc())
            .limit(limit)
        )
    else:
        result = await db.execute(
            select(
                Institution.id, Institution.name, Institution.code,
                func.count(User.id).label("value")
            )
            .join(User, User.institution_id == Institution.id, isouter=True)
            .group_by(Institution.id, Institution.name, Institution.code)
            .order_by(func.count(User.id).desc())
            .limit(limit)
        )

    rows = result.fetchall()
    return {
        "metric": metric,
        "data": [
            {"id": str(r.id), "name": r.name, "code": r.code, "value": r.value}
            for r in rows
        ],
    }


@router.get("/recent-activity")
async def get_recent_activity(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()

    return {
        "activities": [
            {
                "id": str(log.id),
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "username": log.username,
                "created_at": log.created_at.isoformat() if log.created_at else None,
                "ip_address": log.ip_address,
            }
            for log in logs
        ]
    }


@router.get("/alerts")
async def get_system_alerts(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    alerts = []

    expiring_soon = await db.execute(
        select(func.count(Document.id)).where(
            Document.retention_until <= datetime.utcnow() + timedelta(days=90),
            Document.retention_until >= datetime.utcnow(),
            Document.status == DocumentStatus.ARCHIVED,
        )
    )
    n = expiring_soon.scalar() or 0
    if n > 0:
        alerts.append({
            "type": "warning",
            "title": "Documents arrivant à expiration",
            "message": f"{n} document(s) arrivent à expiration dans les 90 prochains jours",
            "count": n,
            "action": "review_retention",
        })

    pending_ocr = await db.execute(
        select(func.count(Document.id)).where(
            Document.status == DocumentStatus.OCR_PROCESSING
        )
    )
    n = pending_ocr.scalar() or 0
    if n > 0:
        alerts.append({
            "type": "info",
            "title": "Documents en traitement OCR",
            "message": f"{n} document(s) en cours de traitement OCR",
            "count": n,
            "action": "monitor_ocr",
        })

    pending_validation = await db.execute(
        select(func.count(Document.id)).where(
            Document.status == DocumentStatus.VALIDATION
        )
    )
    n = pending_validation.scalar() or 0
    if n > 0:
        alerts.append({
            "type": "warning",
            "title": "Documents en attente de validation",
            "message": f"{n} document(s) nécessitent une validation",
            "count": n,
            "action": "validate_documents",
        })

    storage_warnings = await db.execute(
        select(Institution).where(
            Institution.storage_used_gb >= Institution.storage_quota_gb * 0.9
        )
    )
    over_quota = storage_warnings.scalars().all()
    if over_quota:
        alerts.append({
            "type": "danger",
            "title": "Stockage presque plein",
            "message": f"{len(over_quota)} institution(s) ont utilisé plus de 90% de leur quota",
            "count": len(over_quota),
            "action": "manage_storage",
        })

    return {"alerts": alerts, "total": len(alerts)}


@router.get("/geographic")
async def get_geographic_data(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            Institution.id, Institution.name, Institution.code,
            Institution.latitude, Institution.longitude, Institution.type,
            Institution.city,
            func.count(Document.id).label("doc_count"),
        )
        .join(Document, Document.institution_id == Institution.id, isouter=True)
        .where(Institution.latitude != None, Institution.longitude != None)
        .group_by(
            Institution.id, Institution.name, Institution.code,
            Institution.latitude, Institution.longitude, Institution.type, Institution.city
        )
    )
    rows = result.fetchall()

    return {
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [r.longitude, r.latitude],
                },
                "properties": {
                    "id": str(r.id),
                    "name": r.name,
                    "code": r.code,
                    "type": r.type.value if r.type else None,
                    "city": r.city,
                    "doc_count": r.doc_count,
                },
            }
            for r in rows
        ]
    }
