import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
import structlog

from app.database import get_db
from app.models.workflow import WorkflowDefinition, WorkflowInstance, WorkflowStep, StepStatus
from app.models.user import User
from app.api.auth import get_current_active_user

router = APIRouter(prefix="/workflows", tags=["Workflows"])
logger = structlog.get_logger()

DEFAULT_WORKFLOW_STEPS = [
    {"code": "reception", "name": "Réception", "order": 1, "role": "archivist", "sla_hours": 4},
    {"code": "digitization", "name": "Numérisation", "order": 2, "role": "digitizer", "sla_hours": 8},
    {"code": "ocr", "name": "OCR & Reconnaissance", "order": 3, "role": "system", "sla_hours": 2},
    {"code": "validation", "name": "Contrôle de qualité", "order": 4, "role": "archivist", "sla_hours": 24},
    {"code": "indexing", "name": "Indexation", "order": 5, "role": "archivist", "sla_hours": 8},
    {"code": "archiving", "name": "Archivage", "order": 6, "role": "national_archivist", "sla_hours": 4},
    {"code": "publication", "name": "Publication", "order": 7, "role": "validator", "sla_hours": 48},
]


class WorkflowDefinitionCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    code: str
    description: Optional[str] = None
    document_types: List[str] = []
    steps: List[dict] = []
    sla_hours: int = 72
    institution_id: Optional[str] = None


class StepDecision(BaseModel):
    decision: str
    notes: Optional[str] = None
    attachments: Optional[List[str]] = None


@router.post("/definitions", status_code=status.HTTP_201_CREATED)
async def create_workflow_definition(
    data: WorkflowDefinitionCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(WorkflowDefinition).where(WorkflowDefinition.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Code workflow '{data.code}' déjà utilisé")

    steps = data.steps if data.steps else DEFAULT_WORKFLOW_STEPS
    wf = WorkflowDefinition(
        name=data.name,
        name_ar=data.name_ar,
        code=data.code,
        description=data.description,
        document_types=data.document_types,
        steps=steps,
        sla_hours=data.sla_hours,
        created_by=current_user.id,
    )
    if data.institution_id:
        try:
            wf.institution_id = uuid.UUID(data.institution_id)
        except ValueError:
            pass

    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return _format_definition(wf)


@router.get("/definitions")
async def list_workflow_definitions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(WorkflowDefinition).order_by(WorkflowDefinition.name))
    definitions = result.scalars().all()
    return {"items": [_format_definition(d) for d in definitions]}


@router.post("/instances")
async def create_workflow_instance(
    definition_id: str,
    document_id: str,
    priority: str = "normal",
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        def_uuid = uuid.UUID(definition_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID définition invalide")

    result = await db.execute(select(WorkflowDefinition).where(WorkflowDefinition.id == def_uuid))
    definition = result.scalar_one_or_none()
    if not definition:
        raise HTTPException(status_code=404, detail="Définition de workflow non trouvée")

    first_step = definition.steps[0] if definition.steps else None
    instance = WorkflowInstance(
        definition_id=def_uuid,
        current_step=first_step["code"] if first_step else None,
        current_step_index=0,
        status="in_progress",
        priority=priority,
        sla_deadline=datetime.utcnow() + timedelta(hours=definition.sla_hours),
    )
    db.add(instance)
    await db.flush()

    for i, step_def in enumerate(definition.steps):
        step = WorkflowStep(
            workflow_instance_id=instance.id,
            step_code=step_def["code"],
            step_name=step_def["name"],
            step_order=step_def.get("order", i + 1),
            status=StepStatus.IN_PROGRESS if i == 0 else StepStatus.PENDING,
            assigned_role=step_def.get("role"),
            sla_hours=step_def.get("sla_hours"),
            sla_deadline=datetime.utcnow() + timedelta(hours=step_def.get("sla_hours", 24)) if i == 0 else None,
            started_at=datetime.utcnow() if i == 0 else None,
        )
        db.add(step)

    await db.commit()
    await db.refresh(instance)
    return _format_instance(instance)


@router.get("/instances/{instance_id}")
async def get_workflow_instance(
    instance_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        inst_uuid = uuid.UUID(instance_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(
        select(WorkflowInstance).where(WorkflowInstance.id == inst_uuid)
    )
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance de workflow non trouvée")

    steps_result = await db.execute(
        select(WorkflowStep)
        .where(WorkflowStep.workflow_instance_id == inst_uuid)
        .order_by(WorkflowStep.step_order)
    )
    steps = steps_result.scalars().all()

    data = _format_instance(instance)
    data["steps"] = [_format_step(s) for s in steps]
    return data


@router.post("/steps/{step_id}/complete")
async def complete_workflow_step(
    step_id: str,
    decision_data: StepDecision,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        step_uuid = uuid.UUID(step_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID invalide")

    result = await db.execute(select(WorkflowStep).where(WorkflowStep.id == step_uuid))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Étape non trouvée")

    now = datetime.utcnow()
    step.status = StepStatus.COMPLETED if decision_data.decision == "approve" else StepStatus.REJECTED
    step.decision = decision_data.decision
    step.decision_notes = decision_data.notes
    step.completed_at = now
    if step.started_at:
        step.duration_minutes = int((now - step.started_at).total_seconds() / 60)
    step.is_overdue = step.sla_deadline is not None and now > step.sla_deadline

    instance_result = await db.execute(
        select(WorkflowInstance).where(WorkflowInstance.id == step.workflow_instance_id)
    )
    instance = instance_result.scalar_one_or_none()

    if decision_data.decision == "approve" and instance:
        all_steps_result = await db.execute(
            select(WorkflowStep)
            .where(WorkflowStep.workflow_instance_id == instance.id)
            .order_by(WorkflowStep.step_order)
        )
        all_steps = all_steps_result.scalars().all()

        current_idx = next((i for i, s in enumerate(all_steps) if s.id == step.id), -1)
        if current_idx >= 0 and current_idx + 1 < len(all_steps):
            next_step = all_steps[current_idx + 1]
            next_step.status = StepStatus.IN_PROGRESS
            next_step.started_at = now
            if next_step.sla_hours:
                next_step.sla_deadline = now + timedelta(hours=next_step.sla_hours)
            instance.current_step = next_step.step_code
            instance.current_step_index = current_idx + 1
        else:
            instance.status = "completed"
            instance.completed_at = now

    await db.commit()
    return {"message": "Étape complétée", "next_step": instance.current_step if instance else None}


@router.get("/stats")
async def get_workflow_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    total = await db.execute(select(func.count(WorkflowInstance.id)))
    in_progress = await db.execute(
        select(func.count(WorkflowInstance.id)).where(WorkflowInstance.status == "in_progress")
    )
    completed = await db.execute(
        select(func.count(WorkflowInstance.id)).where(WorkflowInstance.status == "completed")
    )
    overdue = await db.execute(
        select(func.count(WorkflowStep.id)).where(
            WorkflowStep.is_overdue == True,
            WorkflowStep.status == StepStatus.IN_PROGRESS,
        )
    )

    return {
        "total_instances": total.scalar() or 0,
        "in_progress": in_progress.scalar() or 0,
        "completed": completed.scalar() or 0,
        "overdue_steps": overdue.scalar() or 0,
    }


def _format_definition(d: WorkflowDefinition) -> dict:
    return {
        "id": str(d.id),
        "name": d.name,
        "name_ar": d.name_ar,
        "code": d.code,
        "description": d.description,
        "document_types": d.document_types,
        "steps": d.steps,
        "sla_hours": d.sla_hours,
        "status": d.status.value if d.status else None,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def _format_instance(i: WorkflowInstance) -> dict:
    return {
        "id": str(i.id),
        "definition_id": str(i.definition_id),
        "current_step": i.current_step,
        "current_step_index": i.current_step_index,
        "status": i.status,
        "priority": i.priority,
        "sla_deadline": i.sla_deadline.isoformat() if i.sla_deadline else None,
        "completed_at": i.completed_at.isoformat() if i.completed_at else None,
        "is_overdue": i.sla_deadline and datetime.utcnow() > i.sla_deadline,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


def _format_step(s: WorkflowStep) -> dict:
    return {
        "id": str(s.id),
        "step_code": s.step_code,
        "step_name": s.step_name,
        "step_order": s.step_order,
        "status": s.status.value if s.status else None,
        "assigned_role": s.assigned_role,
        "decision": s.decision,
        "decision_notes": s.decision_notes,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        "duration_minutes": s.duration_minutes,
        "sla_hours": s.sla_hours,
        "sla_deadline": s.sla_deadline.isoformat() if s.sla_deadline else None,
        "is_overdue": s.is_overdue,
    }
