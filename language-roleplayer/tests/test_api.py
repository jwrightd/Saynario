"""Tests for the REST API endpoints."""

import os
import pytest
from httpx import AsyncClient, ASGITransport

# Force mock mode for tests
os.environ["MOCK_MODE"] = "true"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///test.db"

from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_health_check(client):
    res = await client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["mock_mode"] is True


@pytest.mark.anyio
async def test_list_scenarios(client):
    res = await client.get("/api/scenarios")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


@pytest.mark.anyio
async def test_list_scenarios_filter_language(client):
    res = await client.get("/api/scenarios?language=fr")
    assert res.status_code == 200
    data = res.json()
    for s in data:
        assert s["target_language"] == "fr"


@pytest.mark.anyio
async def test_get_scenario_not_found(client):
    res = await client.get("/api/scenarios/nonexistent-id")
    assert res.status_code == 404


@pytest.mark.anyio
async def test_create_session_not_found_scenario(client):
    res = await client.post("/api/sessions", json={
        "scenario_id": "nonexistent",
        "user_id": "test-user",
    })
    assert res.status_code == 404


@pytest.mark.anyio
async def test_user_progress_default_user(client):
    res = await client.get("/api/users/default-user/progress")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.anyio
async def test_user_not_found(client):
    res = await client.get("/api/users/nobody/progress")
    assert res.status_code == 404
