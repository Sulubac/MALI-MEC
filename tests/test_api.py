"""
PNGA - Tests fonctionnels de l'API
République de Djibouti
"""
import pytest
import asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.database import Base, get_db
from app.config import settings

TEST_DB_URL = "postgresql+asyncpg://pnga:pnga_secure_2024@localhost:5432/pnga_test"

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(test_engine):
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_headers(client):
    """Get auth token for admin user"""
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "Pnga@Djibouti2024!"},
    )
    if response.status_code == 200:
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    # Create admin if doesn't exist
    from app.models.user import User, UserRole, ConfidentialityLevel
    from app.services.auth_service import hash_password
    admin = User(
        username="admin",
        email="admin@test.dj",
        full_name="Admin Test",
        hashed_password=hash_password("Pnga@Djibouti2024!"),
        primary_role=UserRole.SUPER_ADMIN,
        confidentiality_level=ConfidentialityLevel.TOP_SECRET,
        is_active=True,
        is_verified=True,
        is_superuser=True,
    )
    db_session.add(admin)
    await db_session.commit()
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "Pnga@Djibouti2024!"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ─── Health Tests ────────────────────────────────────────────────

class TestHealth:
    async def test_root(self, client):
        r = await client.get("/")
        assert r.status_code == 200
        data = r.json()
        assert "PNGA" in data["name"]
        assert data["status"] == "operational"

    async def test_health(self, client):
        r = await client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"


# ─── Auth Tests ──────────────────────────────────────────────────

class TestAuth:
    async def test_login_valid(self, client, auth_headers):
        assert "Authorization" in auth_headers

    async def test_login_invalid(self, client):
        r = await client.post(
            "/api/v1/auth/login",
            data={"username": "wrong", "password": "wrong"},
        )
        assert r.status_code == 401

    async def test_get_me(self, client, auth_headers):
        r = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["username"] == "admin"
        assert data["is_superuser"] is True

    async def test_unauthorized_access(self, client):
        r = await client.get("/api/v1/documents")
        assert r.status_code == 401

    async def test_register(self, client):
        r = await client.post("/api/v1/auth/register", json={
            "username": "newuser_test",
            "email": "newuser_test@test.dj",
            "password": "Password123!",
            "full_name": "New Test User",
        })
        assert r.status_code in [200, 201]
        assert "user_id" in r.json()


# ─── Institution Tests ───────────────────────────────────────────

class TestInstitutions:
    async def test_create_institution(self, client, auth_headers):
        r = await client.post("/api/v1/institutions", headers=auth_headers, json={
            "code": "TEST-INST-001",
            "name": "Institution Test",
            "name_ar": "مؤسسة اختبار",
            "type": "ministere",
            "city": "Djibouti",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["code"] == "TEST-INST-001"
        assert data["name_ar"] == "مؤسسة اختبار"
        return data["id"]

    async def test_list_institutions(self, client, auth_headers):
        r = await client.get("/api/v1/institutions", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "total" in data

    async def test_institution_tree(self, client, auth_headers):
        r = await client.get("/api/v1/institutions/tree", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "tree" in data
        assert "total" in data

    async def test_duplicate_code(self, client, auth_headers):
        await client.post("/api/v1/institutions", headers=auth_headers, json={
            "code": "DUPL-001", "name": "Test", "type": "service", "city": "Djibouti"
        })
        r = await client.post("/api/v1/institutions", headers=auth_headers, json={
            "code": "DUPL-001", "name": "Duplicate", "type": "service", "city": "Djibouti"
        })
        assert r.status_code == 400


# ─── Document Tests ──────────────────────────────────────────────

class TestDocuments:
    @pytest.fixture
    async def institution_id(self, client, auth_headers):
        r = await client.post("/api/v1/institutions", headers=auth_headers, json={
            "code": "DOC-TEST-INST",
            "name": "Document Test Institution",
            "type": "ministere",
            "city": "Djibouti",
        })
        return r.json()["id"]

    async def test_create_document(self, client, auth_headers, institution_id):
        r = await client.post("/api/v1/documents", headers=auth_headers, json={
            "title": "Décret de Test N°001/2024",
            "title_ar": "مرسوم اختبار رقم 001/2024",
            "type": "decret",
            "institution_id": institution_id,
            "confidentiality": "internal",
            "author": "Président de la République",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["title"] == "Décret de Test N°001/2024"
        assert "reference" in data
        assert data["reference"].startswith("DOC-TEST-INST") or "/" in data["reference"]
        return data["id"]

    async def test_list_documents(self, client, auth_headers):
        r = await client.get("/api/v1/documents", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "total" in data
        assert "pages" in data

    async def test_get_document(self, client, auth_headers, institution_id):
        create_r = await client.post("/api/v1/documents", headers=auth_headers, json={
            "title": "Test Get Document",
            "type": "rapport",
            "institution_id": institution_id,
            "confidentiality": "public",
        })
        doc_id = create_r.json()["id"]
        r = await client.get(f"/api/v1/documents/{doc_id}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == doc_id
        assert data["view_count"] >= 1

    async def test_update_document(self, client, auth_headers, institution_id):
        create_r = await client.post("/api/v1/documents", headers=auth_headers, json={
            "title": "Original Title",
            "type": "note",
            "institution_id": institution_id,
        })
        doc_id = create_r.json()["id"]
        r = await client.patch(f"/api/v1/documents/{doc_id}", headers=auth_headers, json={
            "title": "Updated Title",
            "notes": "Modifié pour test",
        })
        assert r.status_code == 200
        assert r.json()["title"] == "Updated Title"

    async def test_filter_documents(self, client, auth_headers, institution_id):
        r = await client.get(
            "/api/v1/documents",
            headers=auth_headers,
            params={"institution_id": institution_id, "confidentiality": "public"},
        )
        assert r.status_code == 200

    async def test_document_stats(self, client, auth_headers):
        r = await client.get("/api/v1/documents/stats/summary", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total_documents" in data
        assert "by_status" in data
        assert "by_type" in data

    async def test_invalid_doc_id(self, client, auth_headers):
        r = await client.get("/api/v1/documents/not-a-uuid", headers=auth_headers)
        assert r.status_code == 400

    async def test_not_found(self, client, auth_headers):
        import uuid
        r = await client.get(f"/api/v1/documents/{uuid.uuid4()}", headers=auth_headers)
        assert r.status_code == 404


# ─── Search Tests ────────────────────────────────────────────────

class TestSearch:
    async def test_search_empty_query(self, client, auth_headers):
        r = await client.get("/api/v1/search", headers=auth_headers, params={"q": ""})
        assert r.status_code == 200

    async def test_search_with_query(self, client, auth_headers):
        r = await client.get("/api/v1/search", headers=auth_headers, params={"q": "décret"})
        assert r.status_code == 200
        data = r.json()
        assert "hits" in data
        assert "total" in data

    async def test_natural_language_search(self, client, auth_headers):
        r = await client.get(
            "/api/v1/search/natural-language",
            headers=auth_headers,
            params={"q": "Tous les décrets de 2024"},
        )
        assert r.status_code == 200
        data = r.json()
        assert "hits" in data

    async def test_ai_assistant(self, client, auth_headers):
        r = await client.post(
            "/api/v1/search/ai-assistant",
            headers=auth_headers,
            params={"question": "Quels documents sont archivés ?"},
        )
        assert r.status_code == 200
        data = r.json()
        assert "answer" in data
        assert "question" in data


# ─── Dashboard Tests ─────────────────────────────────────────────

class TestDashboard:
    async def test_kpis(self, client, auth_headers):
        r = await client.get("/api/v1/dashboard/kpis", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "totals" in data
        assert "quality" in data
        assert "by_status" in data
        assert "monthly_trend" in data

    async def test_top_institutions(self, client, auth_headers):
        r = await client.get("/api/v1/dashboard/top-institutions", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "data" in data
        assert "metric" in data

    async def test_alerts(self, client, auth_headers):
        r = await client.get("/api/v1/dashboard/alerts", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "alerts" in data
        assert "total" in data

    async def test_recent_activity(self, client, auth_headers):
        r = await client.get("/api/v1/dashboard/recent-activity", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "activities" in data


# ─── Workflow Tests ──────────────────────────────────────────────

class TestWorkflows:
    async def test_list_definitions(self, client, auth_headers):
        r = await client.get("/api/v1/workflows/definitions", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data

    async def test_create_definition(self, client, auth_headers):
        r = await client.post("/api/v1/workflows/definitions", headers=auth_headers, json={
            "name": "Workflow Test",
            "code": "WF-TEST-001",
            "description": "Workflow pour les tests",
            "sla_hours": 48,
        })
        assert r.status_code == 201
        data = r.json()
        assert data["code"] == "WF-TEST-001"

    async def test_workflow_stats(self, client, auth_headers):
        r = await client.get("/api/v1/workflows/stats", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total_instances" in data


# ─── Classification Tests ────────────────────────────────────────

class TestClassification:
    async def test_list_plans(self, client, auth_headers):
        r = await client.get("/api/v1/classification/plans", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data

    async def test_create_plan(self, client, auth_headers):
        r = await client.post("/api/v1/classification/plans", headers=auth_headers, json={
            "code": "TEST-PLAN-001",
            "name": "Plan de Test",
            "name_ar": "خطة الاختبار",
            "version": "1.0",
        })
        assert r.status_code == 201
        data = r.json()
        assert data["code"] == "TEST-PLAN-001"

    async def test_plan_tree(self, client, auth_headers):
        create_r = await client.post("/api/v1/classification/plans", headers=auth_headers, json={
            "code": "TREE-TEST-001",
            "name": "Tree Test Plan",
            "version": "1.0",
        })
        plan_id = create_r.json()["id"]
        r = await client.get(f"/api/v1/classification/plans/{plan_id}/tree", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "tree" in data
        assert "plan" in data


# ─── Physical Archive Tests ──────────────────────────────────────

class TestPhysicalArchives:
    @pytest.fixture
    async def institution_id(self, client, auth_headers):
        r = await client.post("/api/v1/institutions", headers=auth_headers, json={
            "code": "PHYS-TEST-INST",
            "name": "Physical Test Institution",
            "type": "direction",
            "city": "Djibouti",
        })
        return r.json()["id"]

    async def test_create_location(self, client, auth_headers, institution_id):
        r = await client.post("/api/v1/physical/locations", headers=auth_headers, json={
            "institution_id": institution_id,
            "name": "Dépôt Central Test",
            "code": "DEP-TEST-001",
            "type": "depot",
            "city": "Djibouti",
            "capacity_boxes": 1000,
            "is_climate_controlled": True,
        })
        assert r.status_code == 201
        data = r.json()
        assert data["code"] == "DEP-TEST-001"
        assert data["is_climate_controlled"] is True

    async def test_create_box(self, client, auth_headers, institution_id):
        r = await client.post("/api/v1/physical/boxes", headers=auth_headers, json={
            "barcode": "BOX-TEST-2024-001",
            "label": "Boîte Test 001",
            "institution_id": institution_id,
        })
        assert r.status_code == 201
        data = r.json()
        assert data["barcode"] == "BOX-TEST-2024-001"

    async def test_locate_box(self, client, auth_headers, institution_id):
        await client.post("/api/v1/physical/boxes", headers=auth_headers, json={
            "barcode": "LOCATE-BOX-001",
            "institution_id": institution_id,
        })
        r = await client.get("/api/v1/physical/boxes/locate/LOCATE-BOX-001", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["barcode"] == "LOCATE-BOX-001"

    async def test_box_not_found(self, client, auth_headers):
        r = await client.get("/api/v1/physical/boxes/locate/NONEXISTENT-BOX", headers=auth_headers)
        assert r.status_code == 404


# ─── Security Tests ──────────────────────────────────────────────

class TestSecurity:
    async def test_sql_injection_attempt(self, client, auth_headers):
        r = await client.get(
            "/api/v1/documents",
            headers=auth_headers,
            params={"search": "'; DROP TABLE documents; --"},
        )
        assert r.status_code == 200

    async def test_xss_in_title(self, client, auth_headers):
        r = await client.post("/api/v1/institutions", headers=auth_headers, json={
            "code": "XSS-TEST", "name": "<script>alert(1)</script>",
            "type": "service", "city": "Djibouti"
        })
        assert r.status_code in [201, 400]
        if r.status_code == 201:
            assert "<script>" in r.json()["name"]

    async def test_rate_limit_not_triggered_by_normal_use(self, client, auth_headers):
        for _ in range(5):
            r = await client.get("/api/v1/documents", headers=auth_headers)
            assert r.status_code == 200

    async def test_token_expiry_format(self, client):
        r = await client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": "Pnga@Djibouti2024!"},
        )
        if r.status_code == 200:
            data = r.json()
            assert "access_token" in data
            assert "refresh_token" in data
            assert data["expires_in"] > 0
