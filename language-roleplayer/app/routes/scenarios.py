"""REST API routes for scenario management."""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.services.scenario_loader import (
    get_all_scenarios, get_scenario, get_scenarios_by_language,
    get_scenarios_by_difficulty, reload_scenarios,
)
from app.models.schemas import ScenarioOut, ScenarioListItem

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.get("", response_model=list[ScenarioListItem])
async def list_scenarios(
    language: Optional[str] = Query(None, description="Filter by target language (ISO 639-1)"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty level"),
):
    """List all available scenarios, optionally filtered by language and/or difficulty."""
    scenarios = get_all_scenarios()

    if language:
        scenarios = [s for s in scenarios if s.get("target_language") == language]
    if difficulty:
        scenarios = [s for s in scenarios if s.get("difficulty") == difficulty]

    return [
        ScenarioListItem(
            id=s["scenario_id"],
            title=s.get("title", "Untitled"),
            target_language=s.get("target_language", ""),
            difficulty=s.get("difficulty", "beginner"),
            setting=s.get("setting", ""),
            npc_role=s.get("npc_role", ""),
            vocabulary_domain=s.get("vocabulary_domain", []),
        )
        for s in scenarios
    ]


@router.get("/{scenario_id}", response_model=ScenarioOut)
async def get_scenario_detail(scenario_id: str):
    """Get full details of a specific scenario."""
    scenario = get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found")

    return ScenarioOut(
        id=scenario["scenario_id"],
        title=scenario.get("title", "Untitled"),
        target_language=scenario.get("target_language", ""),
        difficulty=scenario.get("difficulty", "beginner"),
        setting=scenario.get("setting", ""),
        npc_role=scenario.get("npc_role", ""),
        npc_personality=scenario.get("npc_personality", "friendly"),
        vocabulary_domain=scenario.get("vocabulary_domain", []),
        max_turns=scenario.get("max_turns", 20),
        opening_line=scenario.get("opening_line", ""),
        success_criteria=scenario.get("success_criteria", ""),
        voice_id=scenario.get("voice_id", ""),
    )


@router.post("/reload")
async def reload_all_scenarios():
    """Admin endpoint: hot-reload all scenario configs from disk."""
    count = reload_scenarios()
    return {"message": f"Reloaded {count} scenarios"}
