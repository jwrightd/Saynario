"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Mode
    mock_mode: bool = False

    # API Keys
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    elevenlabs_api_key: str = ""

    # Whisper
    whisper_mode: str = "api"  # "api" or "local"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/roleplayer"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True

    # Audio
    max_session_duration: int = 1800
    silence_timeout_ms: int = 60000

    # VAD
    vad_threshold: float = 0.5
    vad_silence_timeout_ms: int = 800
    vad_min_speech_ms: int = 300

    # LLM
    # claude-sonnet-4-20250514 is Claude Sonnet 4 (latest stable as of 2025-05)
    claude_model: str = "claude-sonnet-4-20250514"
    max_conversation_turns: int = 40

    # TTS
    elevenlabs_model: str = "eleven_multilingual_v2"
    tts_output_format: str = "mp3_44100_128"
    elevenlabs_fallback_voice_id: str = ""

    # V2: Adaptive difficulty
    adaptive_difficulty_enabled: bool = True
    adaptive_check_every_n_turns: int = 3

    # V2: Sentence-level TTS streaming
    sentence_streaming_enabled: bool = True
    min_sentence_chars_for_tts: int = 20

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
