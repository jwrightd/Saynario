"""In-memory session state manager (Redis-backed in production)."""

import logging
import time
from typing import Optional
from dataclasses import dataclass, field

from app.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class ConversationState:
    """Tracks the state of an active conversation session."""
    session_id: str
    user_id: str
    scenario: dict
    conversation_history: list[dict] = field(default_factory=list)
    turn_count: int = 0
    started_at: float = field(default_factory=time.time)
    is_npc_speaking: bool = False
    audio_buffer: bytes = b""

    def add_user_turn(self, text: str):
        self.conversation_history.append({"role": "user", "content": text})
        self.turn_count += 1

    def add_npc_turn(self, text: str):
        self.conversation_history.append({"role": "assistant", "content": text})
        self.turn_count += 1

    def get_max_turns(self) -> int:
        return self.scenario.get("max_turns", 20)

    def is_over_turn_limit(self) -> bool:
        return self.turn_count >= self.get_max_turns() * 2  # * 2 because each exchange is 2 turns

    def get_user_turns_text(self) -> list[str]:
        return [m["content"] for m in self.conversation_history if m["role"] == "user"]


class SessionManager:
    """Manages active conversation sessions in memory.

    In production, this should be backed by Redis for horizontal scaling.
    This in-memory implementation is suitable for single-instance deployments.
    """

    def __init__(self):
        self._sessions: dict[str, ConversationState] = {}

    def create_session(self, session_id: str, scenario: dict, user_id: str = "default-user") -> ConversationState:
        """Create a new conversation session."""
        state = ConversationState(session_id=session_id, user_id=user_id, scenario=scenario)

        # Add the NPC's opening line as the first turn
        opening_line = scenario.get("opening_line", "")
        if opening_line:
            state.add_npc_turn(opening_line)

        self._sessions[session_id] = state
        logger.info(f"Session created: {session_id}")
        return state

    def get_session(self, session_id: str) -> Optional[ConversationState]:
        """Get an active session by ID."""
        return self._sessions.get(session_id)

    def end_session(self, session_id: str) -> Optional[ConversationState]:
        """End and remove a session, returning its final state."""
        state = self._sessions.pop(session_id, None)
        if state:
            logger.info(f"Session ended: {session_id} ({state.turn_count} turns)")
        return state

    def append_audio(self, session_id: str, audio_chunk: bytes):
        """Append audio data to a session's buffer."""
        state = self._sessions.get(session_id)
        if state:
            state.audio_buffer += audio_chunk

    def get_and_clear_audio(self, session_id: str) -> bytes:
        """Get the accumulated audio buffer and clear it."""
        state = self._sessions.get(session_id)
        if state:
            audio = state.audio_buffer
            state.audio_buffer = b""
            return audio
        return b""

    def list_active_sessions(self) -> list[str]:
        """List all active session IDs."""
        return list(self._sessions.keys())

    def cleanup_stale_sessions(self, max_age_seconds: int = 7200):
        """Remove sessions older than max_age_seconds."""
        now = time.time()
        stale = [
            sid for sid, state in self._sessions.items()
            if now - state.started_at > max_age_seconds
        ]
        for sid in stale:
            self._sessions.pop(sid, None)
            logger.info(f"Cleaned up stale session: {sid}")
        return len(stale)


# Singleton instance
_session_manager: Optional[SessionManager] = None


def get_session_manager() -> SessionManager:
    global _session_manager
    if _session_manager is None:
        _session_manager = SessionManager()
    return _session_manager
