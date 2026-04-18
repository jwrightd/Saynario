"""Scenario configuration loader — reads YAML scenario files."""

import os
import logging
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger(__name__)

# Global scenario registry
_scenarios: dict[str, dict] = {}


def load_scenarios(scenarios_dir: str = "scenarios") -> dict[str, dict]:
    """Load all scenario YAML files from the scenarios directory."""
    global _scenarios
    _scenarios = {}

    base_path = Path(scenarios_dir)
    if not base_path.exists():
        logger.warning(f"Scenarios directory not found: {scenarios_dir}")
        return _scenarios

    for yaml_file in base_path.rglob("*.yaml"):
        try:
            with open(yaml_file, "r", encoding="utf-8") as f:
                scenario = yaml.safe_load(f)

            if scenario and "scenario_id" in scenario:
                _scenarios[scenario["scenario_id"]] = scenario
                logger.info(f"Loaded scenario: {scenario['scenario_id']} ({scenario.get('title', 'Untitled')})")
            else:
                logger.warning(f"Skipping {yaml_file}: missing scenario_id")

        except Exception as e:
            logger.error(f"Error loading {yaml_file}: {e}")

    logger.info(f"Loaded {len(_scenarios)} scenarios total")
    return _scenarios


def get_scenario(scenario_id: str) -> Optional[dict]:
    """Get a scenario by ID."""
    return _scenarios.get(scenario_id)


def get_all_scenarios() -> list[dict]:
    """Get all loaded scenarios."""
    return list(_scenarios.values())


def get_scenarios_by_language(language: str) -> list[dict]:
    """Get all scenarios for a specific language."""
    return [s for s in _scenarios.values() if s.get("target_language") == language]


def get_scenarios_by_difficulty(difficulty: str) -> list[dict]:
    """Get all scenarios of a specific difficulty level."""
    return [s for s in _scenarios.values() if s.get("difficulty") == difficulty]


def reload_scenarios(scenarios_dir: str = "scenarios") -> int:
    """Reload all scenarios (for admin hot-reload endpoint)."""
    load_scenarios(scenarios_dir)
    return len(_scenarios)
