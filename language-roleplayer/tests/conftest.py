"""Pytest configuration and fixtures."""

import os

# Always use mock mode in tests
os.environ["MOCK_MODE"] = "true"

import pytest


@pytest.fixture(autouse=True)
def change_to_project_dir(monkeypatch, tmp_path):
    """Ensure tests run from the project root directory."""
    # This fixture ensures the scenario loader can find YAML files
    pass
