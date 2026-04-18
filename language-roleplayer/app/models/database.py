"""SQLAlchemy database models and session management."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Text, JSON, Enum as SAEnum
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship
import enum

from app.config import get_settings


class Base(DeclarativeBase):
    pass


# ── Enums ────────────────────────────────────────────────────

class Difficulty(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class TurnRole(str, enum.Enum):
    USER = "user"
    NPC = "npc"
    SYSTEM = "system"


# ── Models ───────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False)
    display_name = Column(String, nullable=False)
    native_language = Column(String, default="en")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    sessions = relationship("Session", back_populates="user")
    progress = relationship("Progress", back_populates="user")


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    target_language = Column(String, nullable=False)
    difficulty = Column(SAEnum(Difficulty), nullable=False)
    setting = Column(Text, nullable=False)
    npc_role = Column(String, nullable=False)
    npc_personality = Column(String, default="friendly")
    vocabulary_domain = Column(JSON, default=list)
    max_turns = Column(Integer, default=20)
    opening_line = Column(Text, nullable=False)
    success_criteria = Column(Text, default="")
    voice_id = Column(String, default="")
    config_json = Column(JSON, default=dict)

    sessions = relationship("Session", back_populates="scenario")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ended_at = Column(DateTime, nullable=True)
    status = Column(SAEnum(SessionStatus), default=SessionStatus.ACTIVE)

    user = relationship("User", back_populates="sessions")
    scenario = relationship("Scenario", back_populates="sessions")
    transcripts = relationship("Transcript", back_populates="session", order_by="Transcript.turn_number")
    evaluation = relationship("Evaluation", back_populates="session", uselist=False)


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    turn_number = Column(Integer, nullable=False)
    role = Column(SAEnum(TurnRole), nullable=False)
    text = Column(Text, nullable=False)
    audio_url = Column(String, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("Session", back_populates="transcripts")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("sessions.id"), unique=True, nullable=False)
    overall_score = Column(Float, nullable=False)
    cefr_estimate = Column(String, nullable=False)
    vocabulary_score = Column(Float, default=0.0)
    naturalness_score = Column(Float, default=0.0)
    task_completion = Column(Boolean, default=False)
    grammar_errors_json = Column(JSON, default=list)
    full_report_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("Session", back_populates="evaluation")


class Progress(Base):
    __tablename__ = "progress"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    language = Column(String, nullable=False)
    cefr_level = Column(String, default="A1")
    total_sessions = Column(Integer, default=0)
    avg_score = Column(Float, default=0.0)
    last_session_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="progress")


# ── Engine & Session Factory ─────────────────────────────────

_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(settings.database_url, echo=settings.debug)
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)
    return _session_factory


async def get_db() -> AsyncSession:
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def init_db():
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
