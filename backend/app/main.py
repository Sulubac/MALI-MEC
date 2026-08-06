from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import structlog
import time

from app.config import settings
from app.database import init_db, close_db
from app.api import auth, documents, search, institutions, dashboard, workflows, users, physical, classification

logger = structlog.get_logger()

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting PNGA - Plateforme Nationale de Gestion des Archives", version=settings.APP_VERSION)
    await init_db()
    await _seed_initial_data()
    yield
    await close_db()
    logger.info("PNGA shutdown complete")


async def _seed_initial_data():
    from app.database import AsyncSessionLocal
    from app.models.user import User, UserRole, ConfidentialityLevel
    from app.models.institution import Institution, InstitutionType, InstitutionStatus
    from app.models.classification import ClassificationPlan, ClassificationNode
    from app.models.workflow import WorkflowDefinition, WorkflowStatus
    from app.services.auth_service import hash_password
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        if result.scalar_one_or_none():
            return

        logger.info("Seeding initial data...")

        admin = User(
            username="admin",
            email="admin@archives.gouv.dj",
            full_name="Administrateur National",
            full_name_ar="المسؤول الوطني",
            hashed_password=hash_password("Pnga@Djibouti2024!"),
            primary_role=UserRole.SUPER_ADMIN,
            confidentiality_level=ConfidentialityLevel.TOP_SECRET,
            is_active=True,
            is_verified=True,
            is_superuser=True,
            preferred_language="fr",
        )
        db.add(admin)

        demo_user = User(
            username="archiviste",
            email="archiviste@archives.gouv.dj",
            full_name="Ali Hassan Ibrahim",
            full_name_ar="علي حسن إبراهيم",
            hashed_password=hash_password("Archiviste@2024!"),
            primary_role=UserRole.ARCHIVIST,
            confidentiality_level=ConfidentialityLevel.CONFIDENTIAL,
            is_active=True,
            is_verified=True,
            preferred_language="fr",
        )
        db.add(demo_user)

        presidence = Institution(
            code="PRES",
            name="Présidence de la République",
            name_ar="رئاسة الجمهورية",
            name_en="Presidency of the Republic",
            acronym="PRES",
            type=InstitutionType.PRESIDENCE,
            status=InstitutionStatus.ACTIVE,
            city="Djibouti",
            level=1,
            hierarchy_path="/PRES",
            latitude=11.5897,
            longitude=43.1455,
            storage_quota_gb=1000.0,
        )
        db.add(presidence)

        primature = Institution(
            code="PRIM",
            name="Primature",
            name_ar="رئاسة الحكومة",
            name_en="Prime Minister's Office",
            acronym="PRIM",
            type=InstitutionType.PRIMATURE,
            status=InstitutionStatus.ACTIVE,
            city="Djibouti",
            level=1,
            hierarchy_path="/PRIM",
            latitude=11.5920,
            longitude=43.1480,
            storage_quota_gb=500.0,
        )
        db.add(primature)

        ministries = [
            ("MF", "Ministère des Finances", "وزارة المالية", InstitutionType.MINISTERE, 11.5850, 43.1420),
            ("MI", "Ministère de l'Intérieur", "وزارة الداخلية", InstitutionType.MINISTERE, 11.5880, 43.1410),
            ("MAE", "Ministère des Affaires Étrangères", "وزارة الخارجية", InstitutionType.MINISTERE, 11.5870, 43.1450),
            ("MEN", "Ministère de l'Éducation Nationale", "وزارة التعليم", InstitutionType.MINISTERE, 11.5910, 43.1430),
            ("MS", "Ministère de la Santé", "وزارة الصحة", InstitutionType.MINISTERE, 11.5900, 43.1460),
            ("MJ", "Ministère de la Justice", "وزارة العدل", InstitutionType.MINISTERE, 11.5860, 43.1470),
            ("MT", "Ministère des Transports", "وزارة النقل", InstitutionType.MINISTERE, 11.5930, 43.1440),
            ("SGG", "Secrétariat Général du Gouvernement", "الأمانة العامة للحكومة", InstitutionType.SGG, 11.5940, 43.1450),
        ]

        for code, name, name_ar, inst_type, lat, lon in ministries:
            m = Institution(
                code=code, name=name, name_ar=name_ar,
                type=inst_type, status=InstitutionStatus.ACTIVE,
                city="Djibouti", level=1, hierarchy_path=f"/{code}",
                latitude=lat, longitude=lon, storage_quota_gb=250.0,
            )
            db.add(m)

        await db.flush()

        national_plan = ClassificationPlan(
            code="PNC-DJ-2024",
            name="Plan National de Classement - République de Djibouti",
            name_ar="خطة التصنيف الوطنية - جمهورية جيبوتي",
            description="Plan de classement commun à toutes les administrations publiques djiboutiennes",
            version="1.0",
            is_national=True,
            is_active=True,
            created_by=admin.id,
        )
        db.add(national_plan)
        await db.flush()

        level_names = {1: "Domaine", 2: "Série", 3: "Sous-série", 4: "Dossier"}
        classification_tree = [
            ("ADM", "Administration Générale", "الإدارة العامة", [
                ("ADM-01", "Organisation et Fonctionnement", []),
                ("ADM-02", "Personnel et Ressources Humaines", []),
                ("ADM-03", "Budget et Finances", []),
                ("ADM-04", "Marchés Publics", []),
                ("ADM-05", "Contentieux et Affaires Juridiques", []),
            ]),
            ("GOV", "Gouvernance et Réglementation", "الحوكمة والتنظيم", [
                ("GOV-01", "Lois et Textes Réglementaires", []),
                ("GOV-02", "Décrets et Arrêtés", []),
                ("GOV-03", "Circulaires et Instructions", []),
                ("GOV-04", "Relations Interministérielles", []),
            ]),
            ("ECO", "Économie et Développement", "الاقتصاد والتنمية", [
                ("ECO-01", "Planification et Développement", []),
                ("ECO-02", "Commerce et Industrie", []),
                ("ECO-03", "Port et Zones Franches", []),
                ("ECO-04", "Coopération Internationale", []),
            ]),
            ("SOC", "Affaires Sociales", "الشؤون الاجتماعية", [
                ("SOC-01", "Éducation et Formation", []),
                ("SOC-02", "Santé Publique", []),
                ("SOC-03", "Action Sociale", []),
                ("SOC-04", "Jeunesse et Sports", []),
            ]),
            ("SEC", "Sécurité et Défense", "الأمن والدفاع", [
                ("SEC-01", "Sécurité Nationale", []),
                ("SEC-02", "Gestion des Crises", []),
            ]),
        ]

        for top_code, top_name, top_name_ar, children in classification_tree:
            top_node = ClassificationNode(
                plan_id=national_plan.id,
                code=top_code,
                full_code=top_code,
                name=top_name,
                name_ar=top_name_ar,
                level=1,
                level_name="Domaine",
                is_leaf=len(children) == 0,
            )
            db.add(top_node)
            await db.flush()

            for child_code, child_name, _ in children:
                child_node = ClassificationNode(
                    plan_id=national_plan.id,
                    parent_id=top_node.id,
                    code=child_code,
                    full_code=f"{top_code}.{child_code}",
                    name=child_name,
                    level=2,
                    level_name="Série",
                    is_leaf=True,
                    retention_years=30,
                )
                db.add(child_node)

        default_workflow = WorkflowDefinition(
            name="Workflow Standard d'Archivage",
            name_ar="سير عمل الأرشفة القياسي",
            code="WF-STANDARD",
            description="Workflow par défaut pour tous les documents entrants",
            document_types=["*"],
            steps=[
                {"code": "reception", "name": "Réception du document", "order": 1, "role": "archivist", "sla_hours": 4, "description": "Réception et enregistrement initial"},
                {"code": "digitization", "name": "Numérisation", "order": 2, "role": "digitizer", "sla_hours": 8, "description": "Numérisation haute résolution"},
                {"code": "ocr_ai", "name": "OCR & Analyse IA", "order": 3, "role": "system", "sla_hours": 2, "description": "Traitement automatique OCR et IA"},
                {"code": "quality_control", "name": "Contrôle Qualité", "order": 4, "role": "archivist", "sla_hours": 24, "description": "Vérification qualité et métadonnées"},
                {"code": "indexing", "name": "Indexation", "order": 5, "role": "archivist", "sla_hours": 8, "description": "Indexation et classification"},
                {"code": "validation", "name": "Validation Archiviste", "order": 6, "role": "national_archivist", "sla_hours": 48, "description": "Validation par l'archiviste national"},
                {"code": "archiving", "name": "Archivage Définitif", "order": 7, "role": "system", "sla_hours": 1, "description": "Archivage et conservation définitive"},
                {"code": "publication", "name": "Publication (si public)", "order": 8, "role": "validator", "sla_hours": 24, "description": "Publication sur le portail public"},
            ],
            sla_hours=120,
            is_default=True,
            status=WorkflowStatus.ACTIVE,
            created_by=admin.id,
        )
        db.add(default_workflow)

        await db.commit()
        logger.info("Initial data seeded successfully")


app = FastAPI(
    title=settings.APP_NAME,
    description="""
    **PNGA** - Plateforme Nationale de Gestion des Archives de la République de Djibouti.

    ## Modules principaux

    * **Gestion documentaire** - Cycle de vie complet des documents officiels
    * **Numérisation intelligente** - OCR multilingue (Fr/Ar/En/So/Aa)
    * **Intelligence Artificielle** - Analyse, classification et recherche sémantique
    * **Plan de classement** - Hiérarchie nationale configurable
    * **Workflows** - Gestion des processus documentaires
    * **Sécurité** - AES-256, signatures électroniques, audit trail
    * **Archives physiques** - Gestion des boîtes, rayonnages, RFID
    * **Portail citoyen** - Accès public et demandes

    ## Standards respectés
    ISO 15489 | ISO 14721 (OAIS) | ISO 27001 | MoReq2010 | Dublin Core | PREMIS | METS
    """,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(round(process_time * 1000, 2))
    response.headers["X-PNGA-Version"] = settings.APP_VERSION
    return response


@app.get("/", tags=["Health"])
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "description": "Plateforme Nationale de Gestion des Archives - République de Djibouti",
        "standards": ["ISO 15489", "ISO 14721 OAIS", "ISO 27001", "MoReq2010", "Dublin Core", "PREMIS", "METS"],
        "docs": "/api/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "timestamp": time.time(),
    }


PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(documents.router, prefix=PREFIX)
app.include_router(search.router, prefix=PREFIX)
app.include_router(institutions.router, prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)
app.include_router(workflows.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(physical.router, prefix=PREFIX)
app.include_router(classification.router, prefix=PREFIX)
