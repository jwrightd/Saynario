"""Speech-to-Text service using OpenAI Whisper (API or local).

Heavy ML imports (whisper, torch) are lazy-loaded inside constructors so that
the app starts cleanly in MOCK_MODE without requiring those packages.
"""

import io
import logging
import wave
from abc import ABC, abstractmethod

from app.config import get_settings

logger = logging.getLogger(__name__)


def _is_wav(audio_bytes: bytes) -> bool:
    return len(audio_bytes) >= 12 and audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE"


def _is_webm(audio_bytes: bytes) -> bool:
    return audio_bytes.startswith(b"\x1A\x45\xDF\xA3")


def _is_ogg(audio_bytes: bytes) -> bool:
    return audio_bytes.startswith(b"OggS")


def pcm16le_to_wav_bytes(
    audio_bytes: bytes,
    sample_rate: int = 16000,
    channels: int = 1,
    sample_width: int = 2,
) -> bytes:
    """Wrap raw PCM16 audio in a WAV container for Whisper-compatible uploads."""
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_bytes)
    return wav_buffer.getvalue()


def prepare_audio_for_transcription(
    audio_bytes: bytes,
    sample_rate: int = 16000,
) -> tuple[bytes, str]:
    """
    Return audio bytes and a filename with an extension that matches the payload.

    Raw PCM16 chunks are promoted to WAV so both local and API Whisper paths
    receive a real audio file.
    """
    if _is_wav(audio_bytes):
        return audio_bytes, "audio.wav"

    if _is_webm(audio_bytes):
        return audio_bytes, "audio.webm"

    if _is_ogg(audio_bytes):
        return audio_bytes, "audio.ogg"

    return pcm16le_to_wav_bytes(audio_bytes, sample_rate=sample_rate), "audio.wav"


class STTService(ABC):
    """Abstract base for speech-to-text providers."""

    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, language: str = "en") -> str:
        """Transcribe audio bytes to text in the specified language."""
        ...


class WhisperAPIService(STTService):
    """OpenAI Whisper API-based transcription."""

    def __init__(self):
        try:
            from openai import AsyncOpenAI
        except ImportError as e:
            raise ImportError("openai package required for WhisperAPIService. Run: pip install openai") from e
        settings = get_settings()
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def transcribe(self, audio_bytes: bytes, language: str = "en") -> str:
        prepared_audio, filename = prepare_audio_for_transcription(audio_bytes)
        audio_file = io.BytesIO(prepared_audio)
        audio_file.name = filename

        try:
            response = await self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language=language,
                response_format="text",
            )
            text = response.strip()
            logger.info(f"STT result ({language}): {text[:80]}...")
            return text
        except Exception as e:
            logger.error(f"Whisper API error: {e}")
            raise


class WhisperLocalService(STTService):
    """Local Whisper model transcription (requires GPU + openai-whisper package)."""

    def __init__(self):
        try:
            import whisper
        except ImportError as e:
            raise ImportError(
                "openai-whisper package required for local STT. "
                "Run: pip install openai-whisper   (also needs torch)"
            ) from e
        logger.info("Loading Whisper large-v3 model locally...")
        self.model = whisper.load_model("large-v3")
        logger.info("Whisper model loaded.")

    async def transcribe(self, audio_bytes: bytes, language: str = "en") -> str:
        import tempfile
        import asyncio

        prepared_audio, filename = prepare_audio_for_transcription(audio_bytes)
        suffix = "." + filename.rsplit(".", 1)[-1]

        # Write audio to temp file for Whisper
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
            tmp.write(prepared_audio)
            tmp.flush()

            # Run in executor to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self.model.transcribe(tmp.name, language=language, task="transcribe")
            )

        text = result["text"].strip()
        logger.info(f"STT (local) result ({language}): {text[:80]}...")
        return text


class MockSTTService(STTService):
    """Mock STT for testing without API keys."""

    MOCK_RESPONSES = {
        "fr": "Bonjour, je voudrais un croissant et un cafe, s'il vous plait.",
        "es": "Hola, me gustaria pedir una paella por favor.",
        "de": "Guten Tag, ich haette gerne ein Schnitzel bitte.",
        "ja": "sumimasen, ramen wo hitotsu onegaishimasu.",
        "zh": "ni hao, wo xiang yao yi bei kafei.",
        "it": "Buongiorno, vorrei un espresso per favore.",
        "pt": "Bom dia, eu gostaria de um pastel de nata por favor.",
        "ko": "annyeonghaseyo, bibimbap hana juseyo.",
    }

    async def transcribe(self, audio_bytes: bytes, language: str = "en") -> str:
        text = self.MOCK_RESPONSES.get(language, "Hello, I would like to order something please.")
        logger.info(f"Mock STT ({language}): {text}")
        return text


def create_stt_service() -> STTService:
    """Factory: create the appropriate STT service based on config."""
    settings = get_settings()

    if settings.mock_mode:
        logger.info("Using Mock STT service")
        return MockSTTService()
    elif settings.whisper_mode == "local":
        logger.info("Using local Whisper STT service")
        return WhisperLocalService()
    else:
        logger.info("Using Whisper API STT service")
        return WhisperAPIService()
