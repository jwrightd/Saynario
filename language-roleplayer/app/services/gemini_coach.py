"""Gemini-powered adaptive coach for post-session diagnosis and planning."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from app.config import get_settings
from app.models.schemas import (
    CoachNextScenario,
    CoachRecommendation,
    EvaluationReport,
    LearnerProfile,
    LearnerProfileUpdate,
)

logger = logging.getLogger(__name__)

COACH_PROMPT = """You are Saynario's persistent language coach.

You will receive:
1. The completed conversation transcript
2. Scenario metadata
3. A structured evaluation report
4. The learner's prior memory/profile for this target language

Your job:
- Diagnose the learner's current strengths, weaknesses, vocabulary gaps, and confidence/fluency patterns.
- Update the learner memory in a compact, durable way.
- Choose the single best next practice step.
- Keep the recommendation in the same target language as the completed scenario.

Rules:
- Analyze the learner, not the NPC.
- Ground your reasoning in the transcript and evaluation.
- Keep all arrays concise and practical, maximum 5 items unless absolutely necessary.
- `recommended_difficulty` must be one of: beginner, intermediate, advanced.
- `recommended_correction_mode` must be one of: off, gentle, strict.
- `next_scenario` must be fully runnable inside Saynario with complete fields.
- Prefer a next scenario that is just beyond the learner's comfort zone, not a huge jump.
- Design `next_scenario` as a standalone, self-contained new scene that can appear in the main scenario browser.
- Do not frame `next_scenario` as a sequel, extension, continuation, or "follow-up" version of the previous scenario.
- Set `next_scenario.voice_id` to an empty string unless you have a very strong reason not to.
- `profile_update.recent_sessions_summary` should be newest-first and compact.
- Return only valid JSON matching the provided schema.

Current target language: {target_language}

Scenario metadata:
{scenario_json}

Evaluation report:
{evaluation_json}

Prior learner profile:
{prior_profile_json}

Transcript:
{transcript_json}
"""

GENERIC_OPENING_LINES = {
    "fr": "Bonjour, bienvenue. Qu'est-ce que vous cherchez aujourd'hui ?",
    "es": "Hola, bienvenido. ¿En qué le puedo ayudar?",
    "de": "Hallo, herzlich willkommen. Womit kann ich Ihnen helfen?",
    "ja": "いらっしゃいませ！今日はどのようなご用件でしょうか？",
    "zh": "你好，欢迎光临！今天需要什么帮助？",
    "it": "Buongiorno, benvenuto. Come posso aiutarla oggi?",
    "pt": "Olá, bem-vindo! Como posso ajudá-lo hoje?",
    "ko": "어서 오세요! 오늘은 무엇을 도와드릴까요?",
    "en": "Hello, welcome. What would you like to practice today?",
}

CITY_BY_LANGUAGE = {
    "en": "London",
    "fr": "Paris",
    "es": "Madrid",
    "de": "Berlin",
    "ja": "Kyoto",
    "zh": "Shanghai",
    "it": "Rome",
    "pt": "Lisbon",
    "ko": "Seoul",
}

LOCAL_NAMES = {
    "en": "Maya",
    "fr": "Lea",
    "es": "Lucia",
    "de": "Nina",
    "ja": "Aoi",
    "zh": "Lin",
    "it": "Chiara",
    "pt": "Ines",
    "ko": "Minji",
}

SCENE_TEMPLATES = {
    "cafe": {
        "title": "Asking for Recommendations at a Cafe in {city}",
        "setting": (
            "It is early afternoon at a neighborhood cafe in {city}. "
            "The menu changes often, so you need to ask clarifying questions, "
            "understand the answer, and place a clear order."
        ),
        "npc_role": "A quick but kind cafe server named {name}",
        "npc_personality": "Brisk, observant, and happy to clarify details when the learner asks clearly",
        "success_criteria": "Ask for a recommendation, clarify one detail, and place a complete order politely",
        "vocabulary_domain": ["food", "ordering", "questions", "politeness"],
    },
    "market": {
        "title": "Buying a Small Gift at a Market in {city}",
        "setting": (
            "You are at a busy market in {city} looking for a small gift. "
            "You need to compare options, ask about price or size, and make a final choice."
        ),
        "npc_role": "A market stall owner named {name}",
        "npc_personality": "Friendly, alert, and used to quick back-and-forth questions",
        "success_criteria": "Ask about two options, compare them, and buy one item clearly",
        "vocabulary_domain": ["shopping", "price", "descriptions", "numbers"],
    },
    "transit": {
        "title": "Fixing a Train Mix-Up in {city}",
        "setting": (
            "At a train station in {city}, you realize you may be on the wrong platform. "
            "You need to explain your situation, confirm the right train, and understand the instructions."
        ),
        "npc_role": "A station agent named {name}",
        "npc_personality": "Direct, efficient, and patient when the learner asks precise questions",
        "success_criteria": "Explain the problem, confirm the correct platform, and restate the instructions",
        "vocabulary_domain": ["travel", "directions", "time", "clarification"],
    },
    "office": {
        "title": "Checking In for a Meeting in {city}",
        "setting": (
            "You arrive at a small office in {city} for a scheduled meeting. "
            "You need to introduce yourself, explain who you are meeting, and respond to follow-up questions."
        ),
        "npc_role": "A reception coordinator named {name}",
        "npc_personality": "Professional, concise, and attentive to clear introductions",
        "success_criteria": "Introduce yourself, explain your appointment, and confirm the next step",
        "vocabulary_domain": ["introductions", "work", "time", "politeness"],
    },
    "social": {
        "title": "Joining a Community Class in {city}",
        "setting": (
            "You are visiting a community center in {city} and want to join a short class or activity. "
            "You need to ask what is available, describe your level, and sign up."
        ),
        "npc_role": "A class coordinator named {name}",
        "npc_personality": "Encouraging, sociable, and good at drawing out fuller answers",
        "success_criteria": "Ask about the class, describe your experience level, and register successfully",
        "vocabulary_domain": ["introductions", "schedules", "preferences", "confidence"],
    },
}


def _clean_text(value: str, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text or fallback


def _dedupe_items(items: list[str], limit: int = 5) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for item in items:
        cleaned = _clean_text(item)
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(cleaned)
        if len(deduped) >= limit:
            break
    return deduped


def _normalize_difficulty(value: str, fallback: str = "beginner") -> str:
    cleaned = _clean_text(value, fallback).lower()
    if cleaned in {"beginner", "intermediate", "advanced"}:
        return cleaned
    return fallback


def _normalize_correction_mode(value: str, fallback: str = "gentle") -> str:
    cleaned = _clean_text(value, fallback).lower()
    if cleaned in {"off", "gentle", "strict"}:
        return cleaned
    return fallback


def _next_difficulty(current: str) -> str:
    order = ["beginner", "intermediate", "advanced"]
    current = _normalize_difficulty(current)
    try:
        idx = order.index(current)
    except ValueError:
        return "beginner"
    return order[min(idx + 1, len(order) - 1)]


def _infer_scene_template(scenario: dict, focus_areas: list[str], review_vocab: list[str]) -> str:
    text = " ".join([
        *(scenario.get("vocabulary_domain", []) or []),
        *(focus_areas or []),
        *(review_vocab or []),
        scenario.get("success_criteria", ""),
        scenario.get("setting", ""),
    ]).lower()

    # Rank candidates, then skip if it matches the current scenario's template
    # so the recommendation is always a fresh context.
    current_title = scenario.get("title", "").lower()

    def _current_is(template_key: str) -> bool:
        keywords = {
            "cafe": ["cafe", "coffee", "ramen", "restaurant", "bistro"],
            "market": ["market", "shop", "store", "stall"],
            "transit": ["train", "metro", "station", "bus"],
            "office": ["office", "interview", "meeting", "reception"],
            "social": ["class", "community", "club", "activity"],
        }
        return any(kw in current_title for kw in keywords.get(template_key, []))

    order = []
    if any(kw in text for kw in ["food", "restaurant", "ordering", "menu", "drink", "dish", "cafe", "ramen"]):
        order.append("cafe")
    if any(kw in text for kw in ["shopping", "market", "currency", "price", "gift", "buy"]):
        order.append("market")
    if any(kw in text for kw in ["train", "metro", "station", "platform", "travel", "directions"]):
        order.append("transit")
    if any(kw in text for kw in ["interview", "meeting", "office", "work", "appointment"]):
        order.append("office")
    for t in ["cafe", "market", "transit", "office", "social"]:
        if t not in order:
            order.append(t)

    for candidate in order:
        if not _current_is(candidate):
            return candidate
    return order[0]


def _build_standalone_mock_scenario(
    scenario: dict,
    focus_areas: list[str],
    review_vocab: list[str],
    recommended_difficulty: str,
    target_language: str,
) -> CoachNextScenario:
    template_key = _infer_scene_template(scenario, focus_areas, review_vocab)
    template = SCENE_TEMPLATES[template_key]
    city = CITY_BY_LANGUAGE.get(target_language, "the city")
    name = LOCAL_NAMES.get(target_language, "Mina")
    focus = _clean_text(
        focus_areas[0] if focus_areas else "",
        "staying clear under light pressure",
    )

    return CoachNextScenario(
        title=template["title"].format(city=city),
        target_language=target_language,
        difficulty=recommended_difficulty,
        setting=(
            f"{template['setting'].format(city=city)} "
            f"The learner should pay special attention to {focus.lower()}."
        ),
        npc_role=template["npc_role"].format(name=name),
        npc_personality=template["npc_personality"],
        vocabulary_domain=_dedupe_items(
            [*template["vocabulary_domain"], *review_vocab, *(scenario.get("vocabulary_domain", []) or [])],
            limit=6,
        ),
        max_turns=max(10, min(int(scenario.get("max_turns", 12)), 16)),
        opening_line="",
        success_criteria=template["success_criteria"],
        voice_id="",
    )


def _looks_like_extension(candidate: CoachNextScenario, previous_scenario: dict) -> bool:
    title = _clean_text(candidate.title).lower()
    setting = _clean_text(candidate.setting).lower()
    previous_title = _clean_text(previous_scenario.get("title")).lower()
    flagged_phrases = ["follow-up", "follow up", "continuation", "sequel", "next round", "same scene"]

    if any(phrase in title or phrase in setting for phrase in flagged_phrases):
        return True
    if previous_title and previous_title in title:
        return True
    return False


def _build_recent_summary(
    scenario: dict,
    evaluation: EvaluationReport,
    focus: Optional[str] = None,
) -> str:
    task_result = "completed the task" if evaluation.task_completion else "did not fully complete the task"
    focus_clause = f"; next focus: {focus}" if focus else ""
    return (
        f"{scenario.get('title', 'Conversation')}: scored {round(evaluation.overall_score)} "
        f"({evaluation.cefr_estimate}), {task_result}{focus_clause}."
    )


def _build_mock_profile_update(
    prior_profile: LearnerProfile,
    scenario: dict,
    evaluation: EvaluationReport,
    focus_areas: list[str],
    review_vocab: list[str],
    strengths: list[str],
    confidence_notes: list[str],
) -> LearnerProfileUpdate:
    summary = _build_recent_summary(
        scenario,
        evaluation,
        focus_areas[0] if focus_areas else prior_profile.last_recommended_focus,
    )

    grammar_issues = [error.rule for error in evaluation.grammar_errors if error.rule and error.rule != "No error"]
    if not grammar_issues and evaluation.improvement_areas:
        grammar_issues = evaluation.improvement_areas

    return LearnerProfileUpdate(
        recent_sessions_summary=_dedupe_items(
            [summary, *prior_profile.recent_sessions_summary],
            limit=5,
        ),
        recurring_grammar_issues=_dedupe_items(
            [*grammar_issues, *prior_profile.recurring_grammar_issues],
            limit=5,
        ),
        recurring_vocabulary_gaps=_dedupe_items(
            [*review_vocab, *prior_profile.recurring_vocabulary_gaps],
            limit=6,
        ),
        strengths=_dedupe_items([*strengths, *prior_profile.strengths], limit=5),
        confidence_notes=_dedupe_items([*confidence_notes, *prior_profile.confidence_notes], limit=5),
        last_recommended_focus=_clean_text(
            focus_areas[0] if focus_areas else prior_profile.last_recommended_focus,
            "Build confidence through another practical conversation.",
        ),
    )


def _build_mock_recommendation(
    scenario: dict,
    evaluation: EvaluationReport,
    prior_profile: LearnerProfile,
) -> CoachRecommendation:
    overall = evaluation.overall_score
    scenario_difficulty = _normalize_difficulty(scenario.get("difficulty", "beginner"))

    if overall >= 82:
        recommended_difficulty = _next_difficulty(scenario_difficulty)
        correction_mode = "off" if recommended_difficulty == "advanced" else "gentle"
    elif overall >= 60:
        recommended_difficulty = scenario_difficulty
        correction_mode = "gentle"
    else:
        recommended_difficulty = "beginner"
        correction_mode = "strict"

    strengths = _dedupe_items(
        evaluation.strengths or ["Stayed engaged and kept the conversation moving."],
        limit=4,
    )
    weaknesses = _dedupe_items(
        evaluation.improvement_areas or ["Needs more repetition with core sentence patterns."],
        limit=4,
    )
    review_vocab = _dedupe_items(
        evaluation.suggested_vocabulary or prior_profile.recurring_vocabulary_gaps,
        limit=6,
    )
    focus_areas = _dedupe_items(
        weaknesses + [error.rule for error in evaluation.grammar_errors if error.rule and error.rule != "No error"],
        limit=4,
    )

    confidence_notes = []
    if evaluation.task_completion:
        confidence_notes.append("You can already sustain a goal-oriented exchange when the task is familiar.")
    else:
        confidence_notes.append("You still benefit from lower-pressure repetition before longer open-ended exchanges.")
    if overall >= 70:
        confidence_notes.append("Fluency is growing; the next step should stretch precision rather than basic participation.")
    else:
        confidence_notes.append("Confidence rises when the setting stays practical and the target phrases repeat naturally.")
    confidence_notes = _dedupe_items(confidence_notes, limit=4)

    focus = _clean_text(
        focus_areas[0] if focus_areas else evaluation.improvement_areas[0] if evaluation.improvement_areas else "",
        "Practice clearer phrasing in a familiar real-world task.",
    )

    target_language = scenario.get("target_language", prior_profile.target_language or "fr")
    next_scenario = _build_standalone_mock_scenario(
        scenario=scenario,
        focus_areas=focus_areas,
        review_vocab=review_vocab,
        recommended_difficulty=recommended_difficulty,
        target_language=target_language,
    )

    profile_update = _build_mock_profile_update(
        prior_profile=prior_profile,
        scenario=scenario,
        evaluation=evaluation,
        focus_areas=focus_areas,
        review_vocab=review_vocab,
        strengths=strengths,
        confidence_notes=confidence_notes,
    )

    return CoachRecommendation(
        learner_summary=_clean_text(
            prior_profile.learner_summary,
            "The learner is building functional communication skills and now needs targeted repetition on recurring weak spots.",
        ),
        strengths=strengths,
        weaknesses=weaknesses,
        focus_areas=focus_areas or ["Stabilize core phrases under mild pressure."],
        review_vocab=review_vocab,
        confidence_notes=confidence_notes,
        recommended_difficulty=recommended_difficulty,
        recommended_correction_mode=correction_mode,
        why_this_next=(
            f"This next scene turns {focus.lower()} into the center of a fresh situation, "
            "so the learner can practice the same weak point without repeating the previous roleplay."
        ),
        next_scenario=next_scenario,
        profile_update=profile_update,
    )


def _build_updated_profile(
    user_id: str,
    target_language: str,
    prior_profile: LearnerProfile,
    recommendation: CoachRecommendation,
) -> LearnerProfile:
    from datetime import datetime, timezone

    update = recommendation.profile_update
    recent_sessions_summary = update.recent_sessions_summary or prior_profile.recent_sessions_summary
    recurring_grammar_issues = update.recurring_grammar_issues or prior_profile.recurring_grammar_issues
    recurring_vocabulary_gaps = update.recurring_vocabulary_gaps or prior_profile.recurring_vocabulary_gaps
    strengths = update.strengths or recommendation.strengths or prior_profile.strengths
    confidence_notes = update.confidence_notes or recommendation.confidence_notes or prior_profile.confidence_notes

    return LearnerProfile(
        user_id=user_id,
        target_language=target_language,
        learner_summary=_clean_text(recommendation.learner_summary, prior_profile.learner_summary),
        recent_sessions_summary=_dedupe_items(recent_sessions_summary, limit=5),
        recurring_grammar_issues=_dedupe_items(recurring_grammar_issues, limit=5),
        recurring_vocabulary_gaps=_dedupe_items(recurring_vocabulary_gaps, limit=6),
        strengths=_dedupe_items(strengths, limit=5),
        confidence_notes=_dedupe_items(confidence_notes, limit=5),
        last_recommended_focus=_clean_text(
            update.last_recommended_focus,
            recommendation.focus_areas[0] if recommendation.focus_areas else prior_profile.last_recommended_focus,
        ),
        last_recommended_scenario=recommendation.next_scenario,
        updated_at=datetime.now(timezone.utc),
    )


def _sanitize_recommendation(
    recommendation: CoachRecommendation,
    scenario: dict,
    prior_profile: LearnerProfile,
) -> CoachRecommendation:
    target_language = scenario.get("target_language", prior_profile.target_language or "fr")
    recommended_difficulty = _normalize_difficulty(
        recommendation.recommended_difficulty,
        scenario.get("difficulty", "beginner"),
    )
    correction_mode = _normalize_correction_mode(recommendation.recommended_correction_mode, "gentle")
    next_scenario = recommendation.next_scenario
    fallback_next_scenario = _build_standalone_mock_scenario(
        scenario=scenario,
        focus_areas=recommendation.focus_areas,
        review_vocab=recommendation.review_vocab,
        recommended_difficulty=recommended_difficulty,
        target_language=target_language,
    )

    sanitized_next_scenario = CoachNextScenario(
        title=_clean_text(next_scenario.title, scenario.get("title", "Next practice session")),
        target_language=target_language,
        difficulty=recommended_difficulty,
        setting=_clean_text(next_scenario.setting, scenario.get("setting", "A practical follow-up conversation.")),
        npc_role=_clean_text(next_scenario.npc_role, scenario.get("npc_role", "A helpful conversation partner")),
        npc_personality=_clean_text(
            next_scenario.npc_personality,
            scenario.get("npc_personality", "Supportive and clear."),
        ),
        vocabulary_domain=_dedupe_items(
            list(next_scenario.vocabulary_domain or scenario.get("vocabulary_domain", [])),
            limit=6,
        ),
        max_turns=max(6, min(next_scenario.max_turns, 24)),
        opening_line="",
        success_criteria=_clean_text(
            next_scenario.success_criteria,
            scenario.get("success_criteria", "Practice the target conversation successfully."),
        ),
        voice_id="",
    )

    if _looks_like_extension(sanitized_next_scenario, scenario):
        sanitized_next_scenario = fallback_next_scenario

    profile_update = LearnerProfileUpdate(
        recent_sessions_summary=_dedupe_items(recommendation.profile_update.recent_sessions_summary, limit=5),
        recurring_grammar_issues=_dedupe_items(recommendation.profile_update.recurring_grammar_issues, limit=5),
        recurring_vocabulary_gaps=_dedupe_items(recommendation.profile_update.recurring_vocabulary_gaps, limit=6),
        strengths=_dedupe_items(recommendation.profile_update.strengths, limit=5),
        confidence_notes=_dedupe_items(recommendation.profile_update.confidence_notes, limit=5),
        last_recommended_focus=_clean_text(
            recommendation.profile_update.last_recommended_focus,
            recommendation.focus_areas[0] if recommendation.focus_areas else prior_profile.last_recommended_focus,
        ),
    )

    return CoachRecommendation(
        learner_summary=_clean_text(recommendation.learner_summary, prior_profile.learner_summary),
        strengths=_dedupe_items(recommendation.strengths, limit=5),
        weaknesses=_dedupe_items(recommendation.weaknesses, limit=5),
        focus_areas=_dedupe_items(recommendation.focus_areas, limit=5),
        review_vocab=_dedupe_items(recommendation.review_vocab, limit=6),
        confidence_notes=_dedupe_items(recommendation.confidence_notes, limit=5),
        recommended_difficulty=recommended_difficulty,
        recommended_correction_mode=correction_mode,
        why_this_next=_clean_text(
            recommendation.why_this_next,
            "This next session targets the most important weak point from the latest conversation.",
        ),
        next_scenario=sanitized_next_scenario,
        profile_update=profile_update,
    )


class GeminiCoachService:
    """Adaptive coach backed by Gemini structured outputs."""

    def __init__(self):
        settings = get_settings()
        self.model = settings.gemini_model
        self.api_key = settings.gemini_api_key

        from google import genai

        self.client = genai.Client(api_key=self.api_key)

    async def analyze_session(
        self,
        *,
        user_id: str,
        conversation_history: list[dict],
        scenario: dict,
        evaluation: EvaluationReport,
        prior_profile: LearnerProfile,
    ) -> tuple[CoachRecommendation, LearnerProfile]:
        # Exclude last_recommended_scenario so Gemini doesn't anchor to it
        # and generate a continuation of the previous recommendation.
        profile_for_prompt = prior_profile.model_dump(mode="json")
        profile_for_prompt.pop("last_recommended_scenario", None)

        prompt = COACH_PROMPT.format(
            target_language=scenario.get("target_language", prior_profile.target_language or "fr"),
            scenario_json=json.dumps(scenario, ensure_ascii=False, indent=2),
            evaluation_json=json.dumps(evaluation.model_dump(mode="json"), ensure_ascii=False, indent=2),
            prior_profile_json=json.dumps(profile_for_prompt, ensure_ascii=False, indent=2),
            transcript_json=json.dumps(conversation_history, ensure_ascii=False, indent=2),
        )

        response_text = await asyncio.to_thread(self._generate_structured_output, prompt)
        recommendation = CoachRecommendation.model_validate_json(response_text)
        recommendation = _sanitize_recommendation(recommendation, scenario, prior_profile)
        updated_profile = _build_updated_profile(
            user_id=user_id,
            target_language=scenario.get("target_language", prior_profile.target_language or "fr"),
            prior_profile=prior_profile,
            recommendation=recommendation,
        )
        return recommendation, updated_profile

    def _generate_structured_output(self, prompt: str) -> str:
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_json_schema": CoachRecommendation.model_json_schema(),
            },
        )
        if not getattr(response, "text", None):
            raise ValueError("Gemini returned an empty structured response")
        return response.text


class MockGeminiCoachService:
    """Heuristic fallback so the coach works in demos without Gemini credentials."""

    async def analyze_session(
        self,
        *,
        user_id: str,
        conversation_history: list[dict],
        scenario: dict,
        evaluation: EvaluationReport,
        prior_profile: LearnerProfile,
    ) -> tuple[CoachRecommendation, LearnerProfile]:
        recommendation = _build_mock_recommendation(scenario, evaluation, prior_profile)
        recommendation = _sanitize_recommendation(recommendation, scenario, prior_profile)
        updated_profile = _build_updated_profile(
            user_id=user_id,
            target_language=scenario.get("target_language", prior_profile.target_language or "fr"),
            prior_profile=prior_profile,
            recommendation=recommendation,
        )
        return recommendation, updated_profile


def create_coach_service():
    """Factory: choose Gemini when configured, otherwise a mock fallback."""
    settings = get_settings()
    if settings.mock_mode or not settings.gemini_api_key:
        logger.info("Using mock Gemini coach service")
        return MockGeminiCoachService()

    try:
        logger.info("Using Gemini coach service with model %s", settings.gemini_model)
        return GeminiCoachService()
    except Exception as exc:
        logger.warning("Falling back to mock Gemini coach service: %s", exc)
        return MockGeminiCoachService()
