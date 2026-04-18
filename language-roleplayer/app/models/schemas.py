"""Pydantic schemas for API requests/responses and internal data structures."""

from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime


# ── Scenario ─────────────────────────────────────────────────

class ScenarioOut(BaseModel):
    id: str
    title: str
    target_language: str
    difficulty: str
    setting: str
    npc_role: str
    npc_personality: str
    vocabulary_domain: list[str]
    max_turns: int
    opening_line: str
    success_criteria: str
    voice_id: str

    model_config = {"from_attributes": True}


class ScenarioListItem(BaseModel):
    id: str
    title: str
    target_language: str
    difficulty: str
    setting: str
    npc_role: str
    vocabulary_domain: list[str]

    model_config = {"from_attributes": True}


# ── Session ──────────────────────────────────────────────────

class SessionCreate(BaseModel):
    scenario_id: Optional[str] = None
    custom_scenario: Optional[dict] = None
    user_id: str = "default-user"


class SessionOut(BaseModel):
    id: str
    user_id: str
    scenario_id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    status: str

    model_config = {"from_attributes": True}


class TranscriptEntry(BaseModel):
    turn_number: int
    role: str
    text: str
    timestamp: datetime

    model_config = {"from_attributes": True}


# ── Evaluation ───────────────────────────────────────────────

class GrammarError(BaseModel):
    original: str
    corrected: str
    rule: str
    explanation: str


class EvaluationReport(BaseModel):
    overall_score: float = Field(ge=0, le=100)
    cefr_estimate: str
    vocabulary_score: float = Field(ge=0, le=100)
    naturalness_score: float = Field(ge=0, le=100)
    task_completion: bool
    grammar_errors: list[GrammarError] = []
    strengths: list[str] = []
    improvement_areas: list[str] = []
    suggested_vocabulary: list[str] = []
    cultural_notes: Optional[str] = None


class EvaluationOut(BaseModel):
    id: str
    session_id: str
    overall_score: float
    cefr_estimate: str
    vocabulary_score: float
    naturalness_score: float
    task_completion: bool
    grammar_errors_json: list
    full_report_json: dict
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Adaptive Coach ────────────────────────────────────────────

DifficultyLevel = Literal["beginner", "intermediate", "advanced"]
CorrectionMode = Literal["off", "gentle", "strict"]


class CoachNextScenario(BaseModel):
    title: str
    target_language: str
    difficulty: DifficultyLevel = "beginner"
    setting: str
    npc_role: str
    npc_personality: str
    vocabulary_domain: list[str] = Field(default_factory=list)
    max_turns: int = Field(default=12, ge=6, le=24)
    opening_line: str
    success_criteria: str
    voice_id: str = ""


class LearnerProfileUpdate(BaseModel):
    recent_sessions_summary: list[str] = Field(default_factory=list)
    recurring_grammar_issues: list[str] = Field(default_factory=list)
    recurring_vocabulary_gaps: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    confidence_notes: list[str] = Field(default_factory=list)
    last_recommended_focus: str = ""


class CoachRecommendation(BaseModel):
    learner_summary: str
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    focus_areas: list[str] = Field(default_factory=list)
    review_vocab: list[str] = Field(default_factory=list)
    confidence_notes: list[str] = Field(default_factory=list)
    recommended_difficulty: DifficultyLevel = "beginner"
    recommended_correction_mode: CorrectionMode = "gentle"
    why_this_next: str
    next_scenario: CoachNextScenario
    profile_update: LearnerProfileUpdate = Field(default_factory=LearnerProfileUpdate)


class LearnerProfile(BaseModel):
    user_id: str
    target_language: str
    learner_summary: str = ""
    recent_sessions_summary: list[str] = Field(default_factory=list)
    recurring_grammar_issues: list[str] = Field(default_factory=list)
    recurring_vocabulary_gaps: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    confidence_notes: list[str] = Field(default_factory=list)
    last_recommended_focus: str = ""
    last_recommended_scenario: Optional[CoachNextScenario] = None
    updated_at: datetime


class UserLearnerProfiles(BaseModel):
    user_id: str
    profiles: dict[str, LearnerProfile] = Field(default_factory=dict)


class SessionCompletionOut(BaseModel):
    session_id: str
    status: str
    evaluation: EvaluationReport
    coach: CoachRecommendation
    learner_profile: LearnerProfile


# ── Progress ─────────────────────────────────────────────────

class ProgressOut(BaseModel):
    language: str
    cefr_level: str
    total_sessions: int
    avg_score: float
    last_session_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── WebSocket Messages ───────────────────────────────────────

class WSMessage(BaseModel):
    type: str
    data: dict = {}


# ── User ─────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    display_name: str
    native_language: str = "en"


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    native_language: str
    created_at: datetime

    model_config = {"from_attributes": True}
