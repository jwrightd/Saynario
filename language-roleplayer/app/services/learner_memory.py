"""Lightweight JSON persistence for learner memory profiles."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from app.config import get_settings
from app.models.schemas import LearnerProfile, UserLearnerProfiles

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[2]


class LearnerMemoryStore:
    """Persists learner profiles in per-user JSON files for demo-friendly inspection."""

    def __init__(self, base_dir: Optional[Path] = None):
        settings = get_settings()
        self.base_dir = (base_dir or BASE_DIR / settings.learner_memory_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _file_path(self, user_id: str) -> Path:
        return self.base_dir / f"{user_id}.json"

    def _default_profile(self, user_id: str, target_language: str) -> LearnerProfile:
        return LearnerProfile(
            user_id=user_id,
            target_language=target_language,
            updated_at=self._now(),
        )

    def _load_record(self, user_id: str) -> UserLearnerProfiles:
        path = self._file_path(user_id)
        if not path.exists():
            return UserLearnerProfiles(user_id=user_id)

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return UserLearnerProfiles.model_validate(data)
        except Exception as exc:
            logger.warning("Failed to load learner memory for %s: %s", user_id, exc)
            return UserLearnerProfiles(user_id=user_id)

    def _save_record(self, record: UserLearnerProfiles) -> None:
        path = self._file_path(record.user_id)
        tmp_path = path.with_suffix(".tmp")
        tmp_path.write_text(
            json.dumps(record.model_dump(mode="json"), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp_path.replace(path)

    def _now(self):
        from datetime import datetime, timezone

        return datetime.now(timezone.utc)

    def get_profile(self, user_id: str, target_language: str) -> LearnerProfile:
        record = self._load_record(user_id)
        profile = record.profiles.get(target_language)
        if profile:
            return profile
        return self._default_profile(user_id, target_language)

    def list_profiles(self, user_id: str) -> list[LearnerProfile]:
        record = self._load_record(user_id)
        return sorted(
            record.profiles.values(),
            key=lambda profile: profile.updated_at,
            reverse=True,
        )

    def save_profile(self, profile: LearnerProfile) -> LearnerProfile:
        record = self._load_record(profile.user_id)
        record.profiles[profile.target_language] = profile
        self._save_record(record)
        logger.info(
            "Saved learner profile for %s (%s)",
            profile.user_id,
            profile.target_language,
        )
        return profile


_learner_memory_store: Optional[LearnerMemoryStore] = None


def get_learner_memory_store() -> LearnerMemoryStore:
    global _learner_memory_store
    if _learner_memory_store is None:
        _learner_memory_store = LearnerMemoryStore()
    return _learner_memory_store
