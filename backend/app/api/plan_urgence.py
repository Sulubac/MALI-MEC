"""
PNGA - API du Plan d'urgence des archives
Met en œuvre le Plan d'urgence V3 (actualisation août 2026) :
- Chantiers institutionnels (Annexe I) : 7 phases, statuts, points focaux
- Versements vers la BAN (Annexe II) : 28 institutions, 105 lots, bordereaux, attestations
- Éliminations réglementées (§ V.3.2) : bordereau → visa DAN → procès-verbal
- KPIs du bilan évaluatif (§ VIII) et budget (Annexe V)
"""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_active_user
from app.database import get_db
from app.models.plan_urgence import (BordereauElimination, Chantier,
                                     EliminationStatus, LotStatus,
                                     VersementLot)
from app.models.user import User

router = APIRouter(prefix="/plan-urgence", tags=["Plan d'urgence"])

# ---------------------------------------------------------------------------
# Données de référence (annexes du Plan d'urgence)
# ---------------------------------------------------------------------------

PHASES7 = [
    "Démarrage et cadrage du projet",
    "État des lieux et analyse de l'existant",
    "Traitement du passif documentaire",
    "Numérisation des archives à valeur probante",
    "Transfert des archives historiques vers la BAN",
    "Formations et clôture",
    "Communication, suivi et pilotage",
]

ECHEANCES = ["12 juin 25", "3 juil. 25", "29 sept. 25", "25 déc. 25", "Fév. 26",
             "24 juin 26", "30 juin 26", "30 sept. 26", "30 déc. 26",
             "30 mars 27", "30 juin 27", "30 sept. 27", "30 déc. 27"]
CUTOFF_INDEX = 6  # échéances <= 30 juin 2026 : versements réalisés à l'actualisation

# Annexe II — [institution, n° du premier lot au calendrier, indices d'échéances]
VERSEMENTS_ANNEXE_II = [
    ("Présidence de la République", 4, [0, 2, 6, 8, 10, 12]),
    ("Assemblée nationale", 1, [1, 3, 5, 6, 9, 11]),
    ("Primature", 1, [0, 2, 5, 7, 9, 11, 12]),
    ("Ministère de la Justice et des Affaires Pénitentiaires", 1, [6, 7, 9]),
    ("Ministère de l'Économie et des Finances chargé de l'Industrie", 1, [3, 7, 9, 11]),
    ("Ministère des Affaires Étrangères et de la Coopération Internationale", 1, [7, 9, 11]),
    ("Ministère de la Défense, chargé des Relations avec le Parlement", 1, [7, 9, 11]),
    ("Ministère de l'Intérieur", 1, [3, 7, 9, 11]),
    ("Ministère du Budget", 1, [7, 8, 10, 12]),
    ("Ministère de la Santé", 1, [7, 8, 10, 12]),
    ("Ministère de l'Éducation Nationale et de la Formation Professionnelle", 1, [2, 5, 7, 9, 11]),
    ("Ministère de l'Enseignement Supérieur et de la Recherche", 1, [6, 9, 11]),
    ("Ministère de la Femme et de la Famille", 1, [7, 8, 10, 12]),
    ("Ministère de l'Agriculture, de l'Eau, de la Pêche et de l'Élevage", 1, [7, 8, 10, 12]),
    ("Ministère des Infrastructures et de l'Équipement", 1, [7, 9, 11]),
    ("Ministère des Affaires Musulmanes et des Biens Wakfs", 1, [7, 9, 11]),
    ("Ministère des Affaires Sociales et des Solidarités", 1, [4, 5, 8, 11]),
    ("Ministère de l'Énergie chargé des Ressources Naturelles", 1, [8, 10]),
    ("Ministère du Travail chargé de la Formalisation et de la Protection", 1, [1, 4, 8, 10, 12]),
    ("Ministère de l'Environnement et du Développement Durable", 1, [8, 10, 12]),
    ("Ministère de la Ville, de l'Urbanisme et de l'Habitat", 1, [8, 10, 12]),
    ("Ministère de la Communication, chargé des Postes et des Télécommunications", 1, [3, 7, 9, 11]),
    ("Ministère du Commerce et du Tourisme", 1, [8, 10, 12]),
    ("Ministère de la Jeunesse et de la Culture", 1, [8, 10, 12]),
    ("Ministère Délégué chargé de la Décentralisation", 1, [8, 10, 12]),
    ("Ministère Délégué chargé de l'Économie Numérique et de l'Innovation", 1, [9, 11, 12]),
    ("Secrétariat d'État chargé des Investissements et du Développement du secteur privé", 1, [9, 11, 12]),
    ("Secrétariat d'État chargé des Sports", 1, [9, 11, 12]),
]

# Annexe I — chantiers : (institution, statuts des 7 phases, note, versements réalisés)
# 2 = réalisée, 1 = en cours, 0 = non commencée
CHANTIERS_ANNEXE_I = [
    ("Présidence de la République", [2, 2, 2, 2, 2, 1, 1],
     "Chantier modèle — premier fonds engagé dans l'informatisation", 6),
    ("Assemblée nationale", [2, 2, 2, 2, 1, 1, 1], "", 4),
    ("Primature", [2, 2, 2, 1, 1, 1, 1], "", 3),
    ("Ministère du Travail", [2, 2, 2, 1, 1, 1, 1], "", 2),
    ("Cour Suprême (MJAP)", [1, 1, 1, 0, 0, 0, 0],
     "Dépoussiérage et pré-triage en cours ; manuel opérationnel élaboré", 0),
    ("Tribunal de Première Instance", [1, 0, 0, 0, 0, 0, 0], "Chantier ouvert", 1),
    ("Tribunal du Statut Personnel", [1, 0, 0, 0, 0, 0, 0], "Plan de classement en cours", 0),
    ("Organes de contrôle de l'État", [2, 1, 1, 0, 0, 0, 0],
     "Cour des Comptes, IGE, IGF, CNIPLC, SEPE, DCP — financement PAIC-GEP (BAD/ANSIE)", 0),
    ("Ministère des Affaires Étrangères et de la Coopération Internationale",
     [1, 0, 0, 0, 0, 0, 0], "Chantier ouvert", 0),
    ("Ministère de l'Intérieur", [1, 0, 0, 0, 0, 0, 0], "", 1),
    ("Ministère des Affaires Sociales et des Solidarités", [2, 1, 1, 0, 0, 0, 0], "", 2),
    ("Ministère de la Santé", [1, 0, 0, 0, 0, 0, 0], "Chantier ouvert", 0),
    ("Commune de Boulaos", [1, 0, 0, 0, 0, 0, 0],
     "Traitement des dossiers d'archives engagé", 0),
]

# Annexe V — budget prévisionnel total du projet (FDJ)
BUDGET_ANNEXE_V = {
    "realise_etat": 45_000_000,          # 15 M FDJ / an (budget de l'État)
    "organes_controle_paic_gep": 35_544_200,   # BAD / ANSIE
    "autres_institutions_estime": 112_671_402,
    "total": 193_215_602,
    "devise": "FDJ",
}

_STATUS_MAP = {2: "done", 1: "in_progress", 0: "pending"}


# ---------------------------------------------------------------------------
# Seed (appelé au démarrage depuis main.py)
# ---------------------------------------------------------------------------

async def seed_plan_urgence(session: AsyncSession) -> None:
    """Insère les données des annexes si les tables sont vides."""
    count = (await session.execute(select(func.count(VersementLot.id)))).scalar()
    if count and count > 0:
        return

    for inst, first_lot, indices in VERSEMENTS_ANNEXE_II:
        for pos, ech_idx in enumerate(indices):
            realized = ech_idx <= CUTOFF_INDEX
            lot = VersementLot(
                institution_name=inst,
                lot_number=first_lot + pos,
                echeance_label=ECHEANCES[ech_idx],
                status=LotStatus.received if realized else LotStatus.planned,
                received_at=datetime.utcnow() if realized else None,
                attestation_reference=(
                    f"ATT-BAN-{2025 + (1 if ech_idx >= 4 else 0)}-"
                    f"{uuid.uuid4().hex[:6].upper()}" if realized else None),
            )
            session.add(lot)

    for inst, phases, note, versements in CHANTIERS_ANNEXE_I:
        session.add(Chantier(
            institution_name=inst,
            note=note,
            versements_realises=versements,
            phases=[{"order": i + 1, "name": PHASES7[i],
                     "status": _STATUS_MAP[s]} for i, s in enumerate(phases)],
        ))

    session.add(BordereauElimination(
        reference="BE-2026-014", institution_name="Ministère du Budget",
        description="Doubles de pièces comptables 1998-2005 (DUA expirée)",
        document_count=412, status=EliminationStatus.destroyed,
        visa_by="Direction des Archives Nationales",
        visa_date=datetime.utcnow(), destroyed_at=datetime.utcnow(),
        pv_reference="PV-2026-009", destruction_method="dechiquetage"))
    session.add(BordereauElimination(
        reference="BE-2026-021", institution_name="MENFOP",
        description="Copies d'examens et brouillons administratifs 2001-2010",
        document_count=268, status=EliminationStatus.visaed,
        visa_by="Direction des Archives Nationales", visa_date=datetime.utcnow()))

    await session.commit()


# ---------------------------------------------------------------------------
# Schémas
# ---------------------------------------------------------------------------

class EliminationCreate(BaseModel):
    institution_name: str
    description: str
    document_count: int = 0


class PhaseUpdate(BaseModel):
    order: int
    status: str  # done | in_progress | pending


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/kpis")
async def plan_kpis(db: AsyncSession = Depends(get_db),
                    user: User = Depends(get_current_active_user)):
    """Indicateurs du Plan d'urgence pour le compte rendu en Conseil des Ministres."""
    lots = (await db.execute(select(VersementLot))).scalars().all()
    chantiers = (await db.execute(select(Chantier))).scalars().all()
    elims = (await db.execute(select(BordereauElimination))).scalars().all()

    received = [l for l in lots if l.status == LotStatus.received]
    return {
        "chantiers_ouverts": len(chantiers),
        "institutions_au_calendrier": len({l.institution_name for l in lots}),
        "lots_total": len(lots),
        "lots_realises": len(received),
        "lots_programmes": len(lots) - len(received),
        "versements_presidence": next(
            (c.versements_realises for c in chantiers
             if "Présidence" in c.institution_name), 0),
        "eliminations": {
            s.value: len([e for e in elims if e.status == s])
            for s in EliminationStatus},
        "budget": BUDGET_ANNEXE_V,
    }


@router.get("/versements")
async def list_versements(institution: Optional[str] = None,
                          status: Optional[LotStatus] = None,
                          db: AsyncSession = Depends(get_db),
                          user: User = Depends(get_current_active_user)):
    """Calendrier de versement (Annexe II), groupé par institution."""
    q = select(VersementLot).order_by(VersementLot.institution_name,
                                      VersementLot.lot_number)
    if institution:
        q = q.where(VersementLot.institution_name.ilike(f"%{institution}%"))
    if status:
        q = q.where(VersementLot.status == status)
    lots = (await db.execute(q)).scalars().all()

    grouped: dict = {}
    for l in lots:
        grouped.setdefault(l.institution_name, []).append({
            "id": str(l.id), "lot": l.lot_number, "echeance": l.echeance_label,
            "status": l.status.value, "colis": l.colis_count,
            "bordereau": l.bordereau_reference,
            "attestation": l.attestation_reference,
        })
    return {"echeances": ECHEANCES, "institutions": [
        {"institution": k, "lots": v} for k, v in grouped.items()]}


@router.post("/versements/{lot_id}/advance")
async def advance_versement(lot_id: uuid.UUID,
                            db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_active_user)):
    """Fait progresser un lot : planned → prepared (bordereau) → collected → received (attestation)."""
    lot = (await db.execute(
        select(VersementLot).where(VersementLot.id == lot_id))).scalar_one_or_none()
    if not lot:
        raise HTTPException(404, "Lot introuvable")

    order = [LotStatus.planned, LotStatus.prepared, LotStatus.collected, LotStatus.received]
    idx = order.index(lot.status)
    if idx >= len(order) - 1:
        raise HTTPException(400, "Lot déjà réceptionné par la BAN")

    lot.status = order[idx + 1]
    if lot.status == LotStatus.prepared:
        lot.bordereau_reference = f"BT-{datetime.utcnow().year}-{uuid.uuid4().hex[:6].upper()}"
    if lot.status == LotStatus.received:
        lot.received_at = datetime.utcnow()
        lot.attestation_reference = f"ATT-BAN-{datetime.utcnow().year}-{uuid.uuid4().hex[:6].upper()}"
    await db.commit()
    return {"id": str(lot.id), "status": lot.status.value,
            "bordereau": lot.bordereau_reference,
            "attestation": lot.attestation_reference}


@router.get("/chantiers")
async def list_chantiers(db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_active_user)):
    chantiers = (await db.execute(
        select(Chantier).order_by(Chantier.institution_name))).scalars().all()
    return [{
        "id": str(c.id), "institution": c.institution_name, "note": c.note,
        "focal_point": c.focal_point, "versements_realises": c.versements_realises,
        "phases": c.phases,
        "progress_pct": round(sum(
            100 if p["status"] == "done" else 50 if p["status"] == "in_progress" else 0
            for p in (c.phases or [])) / max(len(c.phases or []), 1)),
    } for c in chantiers]


@router.patch("/chantiers/{chantier_id}/phase")
async def update_phase(chantier_id: uuid.UUID, body: PhaseUpdate,
                       db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_active_user)):
    c = (await db.execute(
        select(Chantier).where(Chantier.id == chantier_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Chantier introuvable")
    if body.status not in ("done", "in_progress", "pending"):
        raise HTTPException(400, "Statut invalide")

    phases = list(c.phases or [])
    for p in phases:
        if p["order"] == body.order:
            p["status"] = body.status
            break
    else:
        raise HTTPException(404, "Phase introuvable")
    c.phases = phases
    await db.commit()
    return {"id": str(c.id), "phases": c.phases}


@router.get("/eliminations")
async def list_eliminations(db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_active_user)):
    elims = (await db.execute(select(BordereauElimination)
             .order_by(BordereauElimination.created_at.desc()))).scalars().all()
    return [{
        "id": str(e.id), "reference": e.reference,
        "institution": e.institution_name, "description": e.description,
        "document_count": e.document_count, "status": e.status.value,
        "visa_by": e.visa_by, "visa_date": e.visa_date,
        "pv_reference": e.pv_reference, "destroyed_at": e.destroyed_at,
    } for e in elims]


@router.post("/eliminations", status_code=201)
async def create_elimination(body: EliminationCreate,
                             db: AsyncSession = Depends(get_db),
                             user: User = Depends(get_current_active_user)):
    ref = f"BE-{datetime.utcnow().year}-{uuid.uuid4().hex[:4].upper()}"
    e = BordereauElimination(
        reference=ref, institution_name=body.institution_name,
        description=body.description, document_count=body.document_count,
        created_by=user.id)
    db.add(e)
    await db.commit()
    return {"id": str(e.id), "reference": ref, "status": e.status.value}


@router.post("/eliminations/{elim_id}/advance")
async def advance_elimination(elim_id: uuid.UUID,
                              db: AsyncSession = Depends(get_db),
                              user: User = Depends(get_current_active_user)):
    """Circuit réglementaire : draft → submitted → visaed (DAN) → destroyed (PV)."""
    e = (await db.execute(select(BordereauElimination)
         .where(BordereauElimination.id == elim_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(404, "Bordereau introuvable")

    order = [EliminationStatus.draft, EliminationStatus.submitted,
             EliminationStatus.visaed, EliminationStatus.destroyed]
    idx = order.index(e.status)
    if idx >= len(order) - 1:
        raise HTTPException(400, "Bordereau déjà clos (destruction attestée)")

    e.status = order[idx + 1]
    if e.status == EliminationStatus.submitted:
        e.submitted_at = datetime.utcnow()
    elif e.status == EliminationStatus.visaed:
        e.visa_date = datetime.utcnow()
        e.visa_by = "Direction des Archives Nationales"
    elif e.status == EliminationStatus.destroyed:
        e.destroyed_at = datetime.utcnow()
        e.pv_reference = f"PV-{datetime.utcnow().year}-{uuid.uuid4().hex[:4].upper()}"
        e.destruction_method = "dechiquetage"
    await db.commit()
    return {"id": str(e.id), "status": e.status.value,
            "visa_by": e.visa_by, "pv_reference": e.pv_reference}
