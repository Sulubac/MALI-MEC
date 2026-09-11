"""
PNGA - Modèles du Plan d'urgence des archives
Plan d'urgence V3 (actualisation août 2026) — MJC / SGG / ANPC-BAN

- VersementLot        : calendrier de versement des institutions vers la BAN (Annexe II)
- Chantier            : chantiers institutionnels en 7 phases (Annexe I)
- BordereauElimination: élimination réglementée — bordereau → visa DAN → PV (§ V.3.2)
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (JSON, Boolean, Column, DateTime, Enum, ForeignKey,
                        Integer, String, Text)
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class LotStatus(str, enum.Enum):
    planned = "planned"          # programmé au calendrier
    prepared = "prepared"        # colis préparés, bordereau élaboré
    collected = "collected"      # enlèvement effectué
    received = "received"        # réception BAN + attestation de transfert


class VersementLot(Base):
    """Un lot du calendrier de versement (Annexe II) — 105 lots pour 28 institutions."""
    __tablename__ = "versement_lots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_name = Column(String(255), nullable=False, index=True)
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id"), nullable=True)
    lot_number = Column(Integer, nullable=False)
    echeance_label = Column(String(50), nullable=False)   # ex. "30 sept. 26"
    echeance_date = Column(DateTime, nullable=True)
    status = Column(Enum(LotStatus), default=LotStatus.planned, nullable=False, index=True)

    colis_count = Column(Integer, default=0)
    bordereau_reference = Column(String(100))              # bordereau de transmission
    attestation_reference = Column(String(100))            # attestation de transfert BAN
    received_at = Column(DateTime, nullable=True)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Chantier(Base):
    """Chantier institutionnel du Plan d'urgence — 7 phases (Annexe I).

    phases : [{"order": 1, "name": "...", "status": "done|in_progress|pending"}, ...]
    """
    __tablename__ = "chantiers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_name = Column(String(255), nullable=False, unique=True)
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id"), nullable=True)
    note = Column(Text)
    phases = Column(JSON, default=list)
    focal_point = Column(String(255))                      # point focal désigné
    versements_realises = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EliminationStatus(str, enum.Enum):
    draft = "draft"              # en préparation
    submitted = "submitted"      # soumis au visa de la Direction des Archives Nationales
    visaed = "visaed"            # visé — destruction autorisée
    destroyed = "destroyed"      # détruit — procès-verbal établi


class BordereauElimination(Base):
    """Bordereau d'élimination réglementaire (§ V.3.2) : préparation → visa DAN → PV."""
    __tablename__ = "bordereaux_elimination"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reference = Column(String(100), unique=True, nullable=False, index=True)
    institution_name = Column(String(255), nullable=False)
    institution_id = Column(UUID(as_uuid=True), ForeignKey("institutions.id"), nullable=True)
    description = Column(Text, nullable=False)
    document_count = Column(Integer, default=0)
    status = Column(Enum(EliminationStatus), default=EliminationStatus.draft,
                    nullable=False, index=True)

    submitted_at = Column(DateTime, nullable=True)
    visa_date = Column(DateTime, nullable=True)
    visa_by = Column(String(255))                          # Direction des Archives Nationales
    pv_reference = Column(String(100))                     # procès-verbal d'élimination
    destroyed_at = Column(DateTime, nullable=True)
    destruction_method = Column(String(50))                # incineration | dechiquetage

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
