import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import structlog

from app.database import get_db
from app.models.classification import ClassificationPlan, ClassificationNode
from app.models.user import User
from app.api.auth import get_current_active_user

router = APIRouter(prefix="/classification", tags=["Plan de Classement"])
logger = structlog.get_logger()


class PlanCreate(BaseModel):
    code: str
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    version: str = "1.0"
    is_national: bool = False


class NodeCreate(BaseModel):
    plan_id: str
    parent_id: Optional[str] = None
    code: str
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    level_name: Optional[str] = None
    sort_order: int = 0
    retention_years: Optional[int] = None
    retention_category: Optional[str] = None
    confidentiality_default: str = "internal"
    is_leaf: bool = False


@router.post("/plans", status_code=status.HTTP_201_CREATED)
async def create_plan(
    data: PlanCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(ClassificationPlan).where(ClassificationPlan.code == data.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Code plan '{data.code}' déjà utilisé")

    plan = ClassificationPlan(
        code=data.code,
        name=data.name,
        name_ar=data.name_ar,
        description=data.description,
        version=data.version,
        is_national=data.is_national,
        created_by=current_user.id,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return _format_plan(plan)


@router.get("/plans")
async def list_plans(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ClassificationPlan).where(ClassificationPlan.is_active == True).order_by(ClassificationPlan.name)
    )
    plans = result.scalars().all()
    return {"items": [_format_plan(p) for p in plans]}


@router.get("/plans/{plan_id}/tree")
async def get_plan_tree(
    plan_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        plan_uuid = uuid.UUID(plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    plan_result = await db.execute(select(ClassificationPlan).where(ClassificationPlan.id == plan_uuid))
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan non trouvé")

    nodes_result = await db.execute(
        select(ClassificationNode)
        .where(ClassificationNode.plan_id == plan_uuid)
        .order_by(ClassificationNode.full_code)
    )
    all_nodes = nodes_result.scalars().all()

    node_map = {str(n.id): _format_node(n) for n in all_nodes}
    for n in all_nodes:
        node_map[str(n.id)]["children"] = []

    roots = []
    for n in all_nodes:
        node_data = node_map[str(n.id)]
        if n.parent_id and str(n.parent_id) in node_map:
            node_map[str(n.parent_id)]["children"].append(node_data)
        else:
            roots.append(node_data)

    return {
        "plan": _format_plan(plan),
        "tree": roots,
        "total_nodes": len(all_nodes),
    }


@router.post("/nodes", status_code=status.HTTP_201_CREATED)
async def create_node(
    data: NodeCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        plan_uuid = uuid.UUID(data.plan_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID plan invalide")

    parent_id = None
    level = 1
    full_code = data.code

    if data.parent_id:
        try:
            parent_uuid = uuid.UUID(data.parent_id)
            parent_result = await db.execute(
                select(ClassificationNode).where(ClassificationNode.id == parent_uuid)
            )
            parent = parent_result.scalar_one_or_none()
            if parent:
                parent_id = parent_uuid
                level = parent.level + 1
                full_code = f"{parent.full_code}.{data.code}"
        except ValueError:
            pass

    node = ClassificationNode(
        plan_id=plan_uuid,
        parent_id=parent_id,
        code=data.code,
        full_code=full_code,
        name=data.name,
        name_ar=data.name_ar,
        description=data.description,
        level=level,
        level_name=data.level_name,
        sort_order=data.sort_order,
        retention_years=data.retention_years,
        retention_category=data.retention_category,
        confidentiality_default=data.confidentiality_default,
        is_leaf=data.is_leaf,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return _format_node(node)


@router.get("/nodes/{node_id}")
async def get_node(
    node_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        node_uuid = uuid.UUID(node_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(ClassificationNode).where(ClassificationNode.id == node_uuid))
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Nœud non trouvé")
    return _format_node(node)


def _format_plan(p: ClassificationPlan) -> dict:
    return {
        "id": str(p.id),
        "code": p.code,
        "name": p.name,
        "name_ar": p.name_ar,
        "description": p.description,
        "version": p.version,
        "is_national": p.is_national,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _format_node(n: ClassificationNode) -> dict:
    return {
        "id": str(n.id),
        "plan_id": str(n.plan_id),
        "parent_id": str(n.parent_id) if n.parent_id else None,
        "code": n.code,
        "full_code": n.full_code,
        "name": n.name,
        "name_ar": n.name_ar,
        "description": n.description,
        "level": n.level,
        "level_name": n.level_name,
        "sort_order": n.sort_order,
        "is_leaf": n.is_leaf,
        "is_active": n.is_active,
        "retention_years": n.retention_years,
        "retention_category": n.retention_category,
        "confidentiality_default": n.confidentiality_default,
        "document_count": n.document_count,
    }
