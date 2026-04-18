"""REST API routes for session management."""

from fastapi import APIRouter, HTTPException

from app.models.schemas import SessionCreate, SessionOut, EvaluationOut, TranscriptEntry
from app.services.scenario_loader import get_scenario
from app.services.session_manager import get_session_manager
from app.services.evaluation import create_evaluation_service

import uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionOut)
async def create_session(body: SessionCreate):
    """Start a new conversation session for a given scenario (built-in or custom)."""
    # Support custom user-created scenarios passed inline
    if body.custom_scenario:
        scenario = body.custom_scenario
        # Ensure required fields have defaults
        scenario.setdefault("id", f"custom_{uuid.uuid4().hex[:8]}")
        scenario.setdefault("title", "Custom Scenario")
        scenario.setdefault("target_language", "fr")
        scenario.setdefault("difficulty", "beginner")
        scenario.setdefault("setting", "")
        scenario.setdefault("npc_role", "NPC")
        scenario.setdefault("npc_personality", "friendly and patient")
        scenario.setdefault("opening_line", "")
        scenario.setdefault("success_criteria", "Have a natural conversation")
        scenario.setdefault("max_turns", 20)
        scenario.setdefault("vocabulary_domain", [])
        scenario.setdefault("voice_id", "")
        scenario_id = scenario["id"]
    elif body.scenario_id:
        scenario = get_scenario(body.scenario_id)
        if not scenario:
            raise HTTPException(status_code=404, detail=f"Scenario '{body.scenario_id}' not found")
        scenario_id = body.scenario_id
    else:
        raise HTTPException(status_code=400, detail="Either scenario_id or custom_scenario must be provided")

    session_id = str(uuid.uuid4())
    manager = get_session_manager()
    manager.create_session(session_id, scenario)

    return SessionOut(
        id=session_id,
        user_id=body.user_id,
        scenario_id=scenario_id,
        started_at=datetime.now(timezone.utc),
        ended_at=None,
        status="active",
    )


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(session_id: str):
    """Get session status and metadata."""
    manager = get_session_manager()
    state = manager.get_session(session_id)

    if not state:
        raise HTTPException(status_code=404, detail="Session not found or already ended")

    return SessionOut(
        id=session_id,
        user_id="default-user",
        scenario_id=state.scenario.get("id", ""),
        started_at=datetime.fromtimestamp(state.started_at, tz=timezone.utc),
        ended_at=None,
        status="active",
    )


@router.get("/{session_id}/transcript", response_model=list[TranscriptEntry])
async def get_transcript(session_id: str):
    """Get the conversation transcript for a session."""
    manager = get_session_manager()
    state = manager.get_session(session_id)

    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    entries = []
    for i, msg in enumerate(state.conversation_history):
        entries.append(TranscriptEntry(
            turn_number=i,
            role=msg["role"],
            text=msg["content"],
            timestamp=datetime.now(timezone.utc),
        ))
    return entries


@router.post("/{session_id}/end")
async def end_session(session_id: str):
    """End a session and trigger the fluency evaluation."""
    manager = get_session_manager()
    state = manager.get_session(session_id)

    if not state:
        raise HTTPException(status_code=404, detail="Session not found or already ended")

    # Run evaluation
    eval_service = create_evaluation_service()
    report = await eval_service.evaluate(
        conversation_history=state.conversation_history,
        scenario=state.scenario,
    )

    # Clean up session
    manager.end_session(session_id)

    return {
        "session_id": session_id,
        "status": "completed",
        "evaluation": report.model_dump(),
    }


@router.get("/{session_id}/evaluation")
async def get_evaluation(session_id: str):
    """Retrieve the evaluation for a completed session."""
    raise HTTPException(
        status_code=501,
        detail="Stored evaluation retrieval not yet implemented. Use POST /sessions/{id}/end to get evaluation inline.",
    )
