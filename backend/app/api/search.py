from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.database import get_db
from app.models.user import User
from app.api.auth import get_current_active_user
from app.services.search_service import search_service
from app.services.ai_service import ai_service

router = APIRouter(prefix="/search", tags=["Recherche"])
logger = structlog.get_logger()


@router.get("/")
async def search_documents(
    q: str = Query("", description="Texte de recherche"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    institution_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    document_types: Optional[List[str]] = Query(None),
    confidentiality_levels: Optional[List[str]] = Query(None),
    sort_by: str = "_score",
    sort_order: str = "desc",
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    results = await search_service.search(
        query=q,
        page=page,
        size=size,
        institution_id=institution_id,
        date_from=date_from,
        date_to=date_to,
        document_types=document_types,
        confidentiality_levels=confidentiality_levels,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return results


@router.get("/natural-language")
async def natural_language_search(
    q: str = Query(..., description="Question en langage naturel"),
    current_user: User = Depends(get_current_active_user),
):
    """
    Recherche en langage naturel.
    Exemples:
    - "Trouve tous les contrats signés entre 2015 et 2020 concernant le Port"
    - "Quels décrets ont été publiés en 1995 ?"
    - "Documents du Ministère des Finances de l'année dernière"
    """
    results = await search_service.natural_language_search(q)
    return {
        "query": q,
        "interpreted": True,
        **results,
    }


@router.get("/suggest")
async def get_suggestions(
    q: str = Query(..., min_length=2),
    current_user: User = Depends(get_current_active_user),
):
    suggestions = await search_service.suggest(q)
    return {"query": q, "suggestions": suggestions}


@router.post("/ai-assistant")
async def ai_assistant_query(
    question: str,
    context_doc_ids: Optional[List[str]] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Assistant IA pour les archivistes.
    Posez des questions comme:
    - "Montre-moi tous les contrats du Ministère des Finances"
    - "Quels documents expirent cette année ?"
    - "Quels dossiers sont incomplets ?"
    """
    search_results = await search_service.natural_language_search(question)
    hits = search_results.get("hits", [])

    context_parts = []
    for hit in hits[:5]:
        src = hit.get("source", {})
        context_parts.append(
            f"Document: {src.get('title', 'Sans titre')}\n"
            f"Type: {src.get('type', '')}\n"
            f"Date: {src.get('document_date', '')}\n"
            f"Résumé: {src.get('content_summary', 'Non disponible')}"
        )

    context = "\n\n---\n\n".join(context_parts)
    answer = await ai_service.answer_question(question, context)

    return {
        "question": question,
        "answer": answer,
        "sources": [
            {
                "id": hit["id"],
                "title": hit["source"].get("title"),
                "type": hit["source"].get("type"),
            }
            for hit in hits[:5]
        ],
        "total_found": search_results.get("total", 0),
    }


@router.get("/advanced")
async def advanced_search(
    q: Optional[str] = None,
    barcode: Optional[str] = None,
    qr_code: Optional[str] = None,
    reference: Optional[str] = None,
    author: Optional[str] = None,
    institution_id: Optional[str] = None,
    document_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    year: Optional[int] = None,
    location: Optional[str] = None,
    keyword: Optional[str] = None,
    person: Optional[str] = None,
    organization: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select, or_, and_
    from app.models.document import Document
    import uuid as uuid_module

    query_parts = []
    if q:
        query_parts.append(q)
    if author:
        query_parts.append(f"auteur:{author}")
    if person:
        query_parts.append(f"personne:{person}")
    if organization:
        query_parts.append(f"organisation:{organization}")
    if keyword:
        query_parts.append(keyword)

    search_query = " ".join(query_parts) if query_parts else ""

    filters = {}
    if institution_id:
        filters["institution_id"] = institution_id
    if document_type:
        filters["document_types"] = [document_type]
    if year:
        filters["date_from"] = f"{year}-01-01"
        filters["date_to"] = f"{year}-12-31"
    elif date_from or date_to:
        if date_from:
            filters["date_from"] = date_from
        if date_to:
            filters["date_to"] = date_to

    results = await search_service.search(query=search_query, **filters)

    if barcode or reference:
        db_query = select(Document)
        db_filters = []
        if barcode:
            db_filters.append(Document.barcode == barcode)
        if reference:
            db_filters.append(Document.reference.ilike(f"%{reference}%"))
        if db_filters:
            db_result = await db.execute(db_query.where(or_(*db_filters)).limit(10))
            db_docs = db_result.scalars().all()
            from app.api.documents import _format_document
            for doc in db_docs:
                results["hits"].insert(0, {
                    "id": str(doc.id),
                    "score": 100.0,
                    "source": _format_document(doc),
                    "highlight": {},
                })

    return results
