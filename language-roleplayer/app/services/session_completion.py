"""Shared end-of-session pipeline for evaluation, coaching, and memory updates."""

from __future__ import annotations

from app.models.schemas import SessionCompletionOut
from app.services.evaluation import create_evaluation_service
from app.services.gemini_coach import create_coach_service
from app.services.learner_memory import get_learner_memory_store
from app.services.session_manager import ConversationState


async def run_session_completion(session_id: str, state: ConversationState) -> SessionCompletionOut:
    """Run the post-session workflow once and return a unified payload."""
    evaluation_service = create_evaluation_service()
    report = await evaluation_service.evaluate(
        conversation_history=state.conversation_history,
        scenario=state.scenario,
    )

    target_language = state.scenario.get("target_language", "fr")
    learner_store = get_learner_memory_store()
    prior_profile = learner_store.get_profile(state.user_id, target_language)

    coach_service = create_coach_service()
    coach, learner_profile = await coach_service.analyze_session(
        user_id=state.user_id,
        conversation_history=state.conversation_history,
        scenario=state.scenario,
        evaluation=report,
        prior_profile=prior_profile,
    )
    learner_store.save_profile(learner_profile)

    return SessionCompletionOut(
        session_id=session_id,
        status="completed",
        evaluation=report,
        coach=coach,
        learner_profile=learner_profile,
    )
