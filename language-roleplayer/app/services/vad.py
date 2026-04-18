"""Voice Activity Detection service using Silero VAD.

Heavy ML imports (torch, silero-vad) are lazy-loaded inside the constructor
so the app runs cleanly in MOCK_MODE without those packages installed.
"""

import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


class VADService:
    """Silero VAD for detecting speech boundaries in audio chunks."""

    def __init__(self):
        settings = get_settings()

        self.threshold = settings.vad_threshold
        self.silence_timeout_ms = settings.vad_silence_timeout_ms
        self.min_speech_ms = settings.vad_min_speech_ms
        self.sample_rate = 16000
        self.model = None

        # Lazy-load Silero VAD — falls back to energy-based VAD if torch/silero not installed
        try:
            import torch
            self.model, utils = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                force_reload=False,
                trust_repo=True,
            )
            self.get_speech_timestamps = utils[0]
            logger.info("Silero VAD model loaded successfully")
        except ImportError:
            logger.warning("torch/silero-vad not installed — using energy-based VAD fallback.")
        except Exception as e:
            logger.warning(f"Could not load Silero VAD: {e}. Falling back to energy-based VAD.")

        # State tracking
        self._speech_started = False
        self._speech_duration_ms = 0
        self._silence_duration_ms = 0
        self._pending_byte = b""

    def reset(self):
        """Reset VAD state for a new utterance."""
        self._speech_started = False
        self._speech_duration_ms = 0
        self._silence_duration_ms = 0
        self._pending_byte = b""
        if self.model is not None:
            self.model.reset_states()

    def process_chunk(self, audio_chunk: bytes, chunk_duration_ms: int = 250) -> dict:
        """
        Process an audio chunk and return VAD state.

        Returns:
            {
                "is_speech": bool,
                "speech_started": bool,
                "speech_ended": bool,
                "speech_duration_ms": int,
                "silence_duration_ms": int,
            }
        """
        audio_chunk = self._normalize_chunk(audio_chunk)
        if not audio_chunk:
            return self._update_state(False, chunk_duration_ms)

        if self.model is not None:
            return self._process_silero(audio_chunk, chunk_duration_ms)
        else:
            return self._process_energy(audio_chunk, chunk_duration_ms)

    def _normalize_chunk(self, audio_chunk: bytes) -> bytes:
        """
        Keep only complete PCM16 frames so a truncated trailing byte cannot
        crash the VAD pipeline.
        """
        if self._pending_byte:
            audio_chunk = self._pending_byte + audio_chunk
            self._pending_byte = b""

        if len(audio_chunk) % 2 == 1:
            self._pending_byte = audio_chunk[-1:]
            audio_chunk = audio_chunk[:-1]
            logger.debug("Dropping trailing partial PCM byte from audio chunk")

        return audio_chunk

    def _process_silero(self, audio_chunk: bytes, chunk_duration_ms: int) -> dict:
        import torch  # already verified available in __init__ if we reach here
        import numpy as np

        # Convert bytes to float32 tensor
        audio_np = np.frombuffer(audio_chunk, dtype=np.int16).astype(np.float32) / 32768.0
        audio_tensor = torch.from_numpy(audio_np)

        # Get speech probability
        speech_prob = self.model(audio_tensor, self.sample_rate).item()
        is_speech = speech_prob > self.threshold

        return self._update_state(is_speech, chunk_duration_ms)

    def _process_energy(self, audio_chunk: bytes, chunk_duration_ms: int) -> dict:
        """Fallback: simple energy-based VAD (no torch required)."""
        import numpy as np
        audio_np = np.frombuffer(audio_chunk, dtype=np.int16).astype(np.float32)
        rms = np.sqrt(np.mean(audio_np ** 2)) if len(audio_np) > 0 else 0
        is_speech = rms > 500  # Simple energy threshold

        return self._update_state(is_speech, chunk_duration_ms)

    def _update_state(self, is_speech: bool, chunk_duration_ms: int) -> dict:
        speech_ended = False

        if is_speech:
            self._silence_duration_ms = 0
            self._speech_duration_ms += chunk_duration_ms

            if not self._speech_started and self._speech_duration_ms >= self.min_speech_ms:
                self._speech_started = True
        else:
            if self._speech_started:
                self._silence_duration_ms += chunk_duration_ms

                if self._silence_duration_ms >= self.silence_timeout_ms:
                    speech_ended = True

        return {
            "is_speech": is_speech,
            "speech_started": self._speech_started,
            "speech_ended": speech_ended,
            "speech_duration_ms": self._speech_duration_ms,
            "silence_duration_ms": self._silence_duration_ms,
        }


class MockVADService:
    """Mock VAD that always detects speech ending after receiving data."""

    def __init__(self):
        self._chunk_count = 0

    def reset(self):
        self._chunk_count = 0

    def process_chunk(self, audio_chunk: bytes, chunk_duration_ms: int = 250) -> dict:
        self._chunk_count += 1
        # Simulate: speech detected for first 3 chunks, then silence
        if self._chunk_count <= 3:
            return {
                "is_speech": True,
                "speech_started": True,
                "speech_ended": False,
                "speech_duration_ms": self._chunk_count * chunk_duration_ms,
                "silence_duration_ms": 0,
            }
        else:
            return {
                "is_speech": False,
                "speech_started": True,
                "speech_ended": True,
                "speech_duration_ms": 3 * chunk_duration_ms,
                "silence_duration_ms": (self._chunk_count - 3) * chunk_duration_ms,
            }


def create_vad_service():
    """Factory: create the appropriate VAD service."""
    settings = get_settings()
    if settings.mock_mode:
        logger.info("Using Mock VAD service")
        return MockVADService()
    else:
        logger.info("Using Silero VAD service")
        return VADService()
