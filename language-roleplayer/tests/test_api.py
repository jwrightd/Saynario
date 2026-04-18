"""Tests for the REST API endpoints."""

import os
import pytest
from httpx import AsyncClient, ASGITransport

# Force mock mode for tests
os.environ["MOCK_MODE"] = "true"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///test.db"
os.environ["LEARNER_MEMORY_DIR"] = ".pytest-learner-memory"

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


@pytest.mark.anyio
async def test_end_session_returns_coach_payload_and_persists_profile(client):
    start_res = await client.post("/api/sessions", json={
        "custom_scenario": {
            "id": "test-fr-coach",
            "title": "Ordering Lunch in Paris",
            "target_language": "fr",
            "difficulty": "beginner",
            "setting": "A Paris bistro at lunchtime.",
            "npc_role": "A friendly waiter named Pierre",
            "npc_personality": "Warm and patient",
            "vocabulary_domain": ["food", "restaurant"],
            "max_turns": 12,
            "opening_line": "Bonjour et bienvenue!",
            "success_criteria": "Order lunch clearly.",
            "voice_id": "",
        },
        "user_id": "default-user",
    })
    assert start_res.status_code == 200
    session_id = start_res.json()["id"]

    end_res = await client.post(f"/api/sessions/{session_id}/end")
    assert end_res.status_code == 200
    payload = end_res.json()

    assert payload["status"] == "completed"
    assert payload["evaluation"]["overall_score"] > 0
    assert payload["coach"]["recommended_difficulty"] in {"beginner", "intermediate", "advanced"}
    assert payload["coach"]["recommended_correction_mode"] in {"off", "gentle", "strict"}
    assert payload["coach"]["next_scenario"]["target_language"] == "fr"
    assert payload["learner_profile"]["user_id"] == "default-user"
    assert payload["learner_profile"]["target_language"] == "fr"

    profile_res = await client.get("/api/users/default-user/coach-profile/fr")
    assert profile_res.status_code == 200
    profile = profile_res.json()
    assert profile["last_recommended_scenario"]["title"] == payload["coach"]["next_scenario"]["title"]


@pytest.mark.anyio
async def test_list_coach_profiles(client):
    res = await client.get("/api/users/default-user/coach-profiles")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
