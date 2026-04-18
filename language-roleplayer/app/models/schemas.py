"""Pydantic schemas for API requests/responses and internal data structures."""

from pydantic import BaseModel, Field
from typing import Optional
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
