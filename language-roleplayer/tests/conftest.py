"""Pytest configuration and fixtures."""

import os
from pathlib import Path

# Always use mock mode in tests
os.environ["MOCK_MODE"] = "true"
os.environ.setdefault("LEARNER_MEMORY_DIR", ".pytest-learner-memory")

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def change_to_project_dir(monkeypatch):
    """Ensure tests run from the project root directory."""
    monkeypatch.chdir(PROJECT_ROOT)

    memory_dir = PROJECT_ROOT / os.environ["LEARNER_MEMORY_DIR"]
    memory_dir.mkdir(parents=True, exist_ok=True)
    for path in memory_dir.glob("*.json"):
        path.unlink()

    try:
        from app.config import get_settings
        get_settings.cache_clear()
    except Exception:
        pass

    try:
        import app.services.learner_memory as learner_memory
        learner_memory._learner_memory_store = None
    except Exception:
        pass

    try:
        import app.services.session_manager as session_manager
        session_manager._session_manager = None
    except Exception:
        pass

    yield
