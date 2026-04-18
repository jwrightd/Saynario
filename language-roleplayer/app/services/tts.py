"""Text-to-Speech service using ElevenLabs.

Compatible with elevenlabs SDK v2.x+.
Uses sentence-level streaming for reduced perceived latency (V2 improvement).
"""

import logging
import re
from typing import AsyncGenerator

from app.config import get_settings

logger = logging.getLogger(__name__)

# Default voice IDs for different languages (ElevenLabs multilingual voices)
DEFAULT_VOICES = {
    "fr": "pFZP5JQG7iQjIQuC4Bku",  # Lily
    "es": "jBpfuIE2acCO8z3wKNLl",  # Gigi
    "de": "cgSgspJ2msm6clMCkdW9",  # Jessica
    "ja": "Xb7hH8MSUJpSbSDYk0k2",  # Alice
    "zh": "Xb7hH8MSUJpSbSDYk0k2",  # Alice
    "it": "pFZP5JQG7iQjIQuC4Bku",  # Lily
    "pt": "jBpfuIE2acCO8z3wKNLl",  # Gigi
    "ko": "Xb7hH8MSUJpSbSDYk0k2",  # Alice
}

# Minimum chars before sending a sentence chunk to TTS (avoids sending "Well," alone)
MIN_SENTENCE_CHARS = 20


class TTSService:
    """ElevenLabs text-to-speech service (elevenlabs SDK v2.x).

    Uses optimize_streaming_latency=4 and the .stream() endpoint for
    maximum throughput with minimum first-chunk latency.
    """

    def __init__(self):
        try:
            from elevenlabs.client import AsyncElevenLabs
        except ImportError as e:
            raise ImportError("elevenlabs package required. Run: pip install elevenlabs") from e

        settings = get_settings()
        self.client = AsyncElevenLabs(api_key=settings.elevenlabs_api_key)
        self.model = settings.elevenlabs_model
        self.output_format = settings.tts_output_format
        self.global_fallback_voice_id = settings.elevenlabs_fallback_voice_id

    def _get_voice_id(self, language: str, scenario_voice_id: str = "") -> str:
        if scenario_voice_id:
            return scenario_voice_id
        return DEFAULT_VOICES.get(language, DEFAULT_VOICES["fr"])

    def _get_default_voice_id(self, language: str) -> str:
        if self.global_fallback_voice_id:
            return self.global_fallback_voice_id
        return DEFAULT_VOICES.get(language, DEFAULT_VOICES["fr"])

    async def _stream_request(self, text: str, voice_id: str):
        async for chunk in self.client.text_to_speech.stream(
            voice_id=voice_id,
            text=text,
            model_id=self.model,
            output_format=self.output_format,
            optimize_streaming_latency=4,
        ):
            if chunk:
                yield chunk

    async def synthesize(self, text: str, language: str = "fr", voice_id: str = "") -> bytes:
        """Synthesize full audio from text (collects all streamed chunks)."""
        requested_voice_id = self._get_voice_id(language, voice_id)
        default_voice_id = self._get_default_voice_id(language)

        try:
            audio_bytes = b""
            async for chunk in self._stream_request(text, requested_voice_id):
                audio_bytes += chunk
            logger.info(f"TTS synthesized {len(audio_bytes)} bytes for {language}")
            return audio_bytes
        except Exception as e:
            if voice_id and requested_voice_id != default_voice_id:
                logger.warning(
                    "ElevenLabs voice %s failed for %s; retrying with default voice %s. Error: %s",
                    requested_voice_id,
                    language,
                    default_voice_id,
                    e,
                )
                audio_bytes = b""
                async for chunk in self._stream_request(text, default_voice_id):
                    audio_bytes += chunk
                logger.info(
                    "TTS synthesized %s bytes for %s using fallback voice",
                    len(audio_bytes),
                    language,
                )
                return audio_bytes

            logger.error(f"ElevenLabs API error: {e}")
            raise

    async def stream_synthesis(
        self, text: str, language: str = "fr", voice_id: str = ""
    ) -> AsyncGenerator[bytes, None]:
        """Stream audio chunks as they're generated.

        Uses optimize_streaming_latency=4 for minimum first-chunk latency.
        """
        requested_voice_id = self._get_voice_id(language, voice_id)
        default_voice_id = self._get_default_voice_id(language)

        try:
            async for chunk in self._stream_request(text, requested_voice_id):
                yield chunk
        except Exception as e:
            if voice_id and requested_voice_id != default_voice_id:
                logger.warning(
                    "ElevenLabs streaming voice %s failed for %s; retrying with default voice %s. Error: %s",
                    requested_voice_id,
                    language,
                    default_voice_id,
                    e,
                )
                async for chunk in self._stream_request(text, default_voice_id):
                    yield chunk
                return

            logger.error(f"ElevenLabs streaming error: {e}")
            raise


def split_into_sentences(text: str) -> list[str]:
    """Split text into sentences for sentence-level TTS streaming.

    Only returns sentences longer than MIN_SENTENCE_CHARS to avoid
    sending very short fragments (e.g. "Ah,") to TTS.
    """
    # Split on sentence-ending punctuation followed by whitespace or end of string
    parts = re.split(r'(?<=[.!?…])\s+', text.strip())
    sentences = []
    buffer = ""
    for part in parts:
        buffer = (buffer + " " + part).strip() if buffer else part
        if len(buffer) >= MIN_SENTENCE_CHARS:
            sentences.append(buffer)
            buffer = ""
    if buffer:
        sentences.append(buffer)
    return sentences


class MockTTSService:
    """Mock TTS that returns a tiny silent MP3 payload without API calls."""

    # Minimal valid MP3 frame (44 bytes of silence)
    _SILENT_FRAME = bytes([
        0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x6E, 0x66, 0x6F,
        0x00, 0x00, 0x00, 0x0F,
    ])
    SILENT_MP3 = _SILENT_FRAME * 20  # ~880 bytes, plays as ~0.1s silence

    async def synthesize(self, text: str, language: str = "fr", voice_id: str = "") -> bytes:
        logger.info(f"Mock TTS: '{text[:40]}...' ({language})")
        return self.SILENT_MP3

    async def stream_synthesis(
        self, text: str, language: str = "fr", voice_id: str = ""
    ) -> AsyncGenerator[bytes, None]:
        logger.info(f"Mock TTS stream: '{text[:40]}...' ({language})")
        chunk_size = len(self.SILENT_MP3) // 4
        for i in range(0, len(self.SILENT_MP3), chunk_size):
            yield self.SILENT_MP3[i:i + chunk_size]


def create_tts_service():
    """Factory: return the appropriate TTS service based on config."""
    settings = get_settings()
    if settings.mock_mode:
        logger.info("Using Mock TTS service")
        return MockTTSService()
    logger.info("Using ElevenLabs TTS service (v2 SDK, optimize_streaming_latency=4)")
    return TTSService()
