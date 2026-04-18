"""Tests for the core service modules."""

import os
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

# Force mock mode
os.environ["MOCK_MODE"] = "true"

from app.services.stt import (
    create_stt_service,
    MockSTTService,
    pcm16le_to_wav_bytes,
    prepare_audio_for_transcription,
)
from app.services.llm import create_llm_service, MockLLMService, LLMService
from app.services.tts import create_tts_service, MockTTSService, TTSService
from app.services.vad import create_vad_service, MockVADService
from app.services.evaluation import create_evaluation_service, MockEvaluationService
from app.services.gemini_coach import create_coach_service, MockGeminiCoachService
from app.services.session_manager import SessionManager
from app.services.scenario_loader import load_scenarios, get_scenario, get_all_scenarios
from app.models.schemas import LearnerProfile


# ── Factory Tests ──────────────────────────────────────────

def test_stt_factory_returns_mock():
    stt = create_stt_service()
    assert isinstance(stt, MockSTTService)


def test_llm_factory_returns_mock():
    llm = create_llm_service()
    assert isinstance(llm, MockLLMService)


def test_tts_factory_returns_mock():
    tts = create_tts_service()
    assert isinstance(tts, MockTTSService)


def test_vad_factory_returns_mock():
    vad = create_vad_service()
    assert isinstance(vad, MockVADService)


def test_eval_factory_returns_mock():
    ev = create_evaluation_service()
    assert isinstance(ev, MockEvaluationService)


def test_coach_factory_returns_mock_without_credentials():
    coach = create_coach_service()
    assert isinstance(coach, MockGeminiCoachService)


# ── Mock STT ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_mock_stt_french():
    stt = MockSTTService()
    text = await stt.transcribe(b"fake audio", "fr")
    assert len(text) > 0
    assert isinstance(text, str)


@pytest.mark.asyncio
async def test_mock_stt_default():
    stt = MockSTTService()
    text = await stt.transcribe(b"fake audio", "xx")
    assert "Hello" in text


def test_prepare_audio_for_transcription_wraps_raw_pcm():
    raw_pcm = b"\x00\x00\xff\x7f"
    prepared_audio, filename = prepare_audio_for_transcription(raw_pcm)

    assert filename == "audio.wav"
    assert prepared_audio[:4] == b"RIFF"
    assert prepared_audio[8:12] == b"WAVE"
    assert len(prepared_audio) > len(raw_pcm)


def test_prepare_audio_for_transcription_preserves_webm():
    webm_audio = b"\x1A\x45\xDF\xA3mock-webm"
    prepared_audio, filename = prepare_audio_for_transcription(webm_audio)

    assert filename == "audio.webm"
    assert prepared_audio == webm_audio


def test_pcm16le_to_wav_bytes_includes_pcm_payload():
    raw_pcm = b"\x00\x00\x01\x00\xff\x7f"
    wav_audio = pcm16le_to_wav_bytes(raw_pcm)

    assert wav_audio[:4] == b"RIFF"
    assert wav_audio.endswith(raw_pcm)


# ── Mock LLM ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_mock_llm_response():
    llm = MockLLMService()
    scenario = {"target_language": "fr"}
    response = await llm.generate_response([], scenario)
    assert len(response) > 0


@pytest.mark.asyncio
async def test_mock_llm_streaming():
    llm = MockLLMService()
    scenario = {"target_language": "es"}
    tokens = []
    async for token in llm.stream_response([], scenario):
        tokens.append(token)
    assert len(tokens) > 0
    full_text = "".join(tokens)
    assert len(full_text) > 0


def test_vocab_hint_payload_parser_handles_fenced_json():
    payload = """```json
    [{"word":"bonjour","translation":"hello","type":"phrase"}]
    ```"""

    result = LLMService._parse_vocab_hint_payload(payload, __import__("json"))

    assert result == [{"word": "bonjour", "translation": "hello", "type": "phrase"}]


# ── Mock TTS ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_mock_tts_synthesis():
    tts = MockTTSService()
    audio = await tts.synthesize("Bonjour", "fr")
    assert isinstance(audio, bytes)
    assert len(audio) > 0


@pytest.mark.asyncio
async def test_mock_tts_streaming():
    tts = MockTTSService()
    chunks = []
    async for chunk in tts.stream_synthesis("Hola", "es"):
        chunks.append(chunk)
    assert len(chunks) > 0


@pytest.mark.asyncio
async def test_tts_synthesize_falls_back_to_default_voice():
    attempts = []

    async def fake_stream(**kwargs):
        attempts.append(kwargs["voice_id"])
        if kwargs["voice_id"] == "custom-voice":
            raise RuntimeError("voice unavailable")
        yield b"fallback-audio"

    tts = TTSService.__new__(TTSService)
    tts.client = SimpleNamespace(text_to_speech=SimpleNamespace(stream=fake_stream))
    tts.model = "test-model"
    tts.output_format = "mp3_44100_128"
    tts.global_fallback_voice_id = ""

    audio = await tts.synthesize("Hola", "es", "custom-voice")

    assert audio == b"fallback-audio"
    assert attempts == ["custom-voice", "jBpfuIE2acCO8z3wKNLl"]


@pytest.mark.asyncio
async def test_tts_stream_synthesis_falls_back_to_default_voice():
    attempts = []

    async def fake_stream(**kwargs):
        attempts.append(kwargs["voice_id"])
        if kwargs["voice_id"] == "custom-voice":
            raise RuntimeError("voice unavailable")
        yield b"chunk-1"
        yield b"chunk-2"

    tts = TTSService.__new__(TTSService)
    tts.client = SimpleNamespace(text_to_speech=SimpleNamespace(stream=fake_stream))
    tts.model = "test-model"
    tts.output_format = "mp3_44100_128"
    tts.global_fallback_voice_id = ""

    chunks = []
    async for chunk in tts.stream_synthesis("Hola", "es", "custom-voice"):
        chunks.append(chunk)

    assert chunks == [b"chunk-1", b"chunk-2"]
    assert attempts == ["custom-voice", "jBpfuIE2acCO8z3wKNLl"]


@pytest.mark.asyncio
async def test_tts_prefers_global_fallback_voice_when_configured():
    attempts = []

    async def fake_stream(**kwargs):
        attempts.append(kwargs["voice_id"])
        if kwargs["voice_id"] == "custom-voice":
            raise RuntimeError("voice unavailable")
        yield b"fallback-audio"

    tts = TTSService.__new__(TTSService)
    tts.client = SimpleNamespace(text_to_speech=SimpleNamespace(stream=fake_stream))
    tts.model = "test-model"
    tts.output_format = "mp3_44100_128"
    tts.global_fallback_voice_id = "global-safe-voice"

    audio = await tts.synthesize("Hola", "es", "custom-voice")

    assert audio == b"fallback-audio"
    assert attempts == ["custom-voice", "global-safe-voice"]


# ── Mock VAD ──────────────────────────────────────────────

def test_mock_vad_detects_speech_end():
    vad = MockVADService()
    # First 3 chunks should be speech
    for _ in range(3):
        result = vad.process_chunk(b"x" * 100)
        assert result["is_speech"] is True
        assert result["speech_ended"] is False

    # 4th chunk should signal speech ended
    result = vad.process_chunk(b"x" * 100)
    assert result["speech_ended"] is True


def test_mock_vad_reset():
    vad = MockVADService()
    for _ in range(5):
        vad.process_chunk(b"x" * 100)
    vad.reset()
    result = vad.process_chunk(b"x" * 100)
    assert result["is_speech"] is True
    assert result["speech_ended"] is False


# ── Mock Evaluation ───────────────────────────────────────

@pytest.mark.asyncio
async def test_mock_evaluation():
    ev = MockEvaluationService()
    report = await ev.evaluate(
        [{"role": "user", "content": "Bonjour"}],
        {"target_language": "fr", "difficulty": "beginner"},
    )
    assert report.overall_score > 0
    assert report.cefr_estimate in ["A1", "A2", "B1", "B2", "C1", "C2"]
    assert isinstance(report.grammar_errors, list)


@pytest.mark.asyncio
async def test_mock_coach_generates_recommendation_and_profile():
    coach = MockGeminiCoachService()
    prior_profile = LearnerProfile(
        user_id="default-user",
        target_language="fr",
        updated_at=datetime.now(timezone.utc),
    )

    evaluation = await MockEvaluationService().evaluate(
        [{"role": "user", "content": "Bonjour, je veux un cafe"}],
        {
            "title": "Ordering Lunch in Paris",
            "target_language": "fr",
            "difficulty": "beginner",
            "setting": "A Paris bistro.",
            "npc_role": "A friendly waiter",
            "npc_personality": "Warm and patient",
            "opening_line": "Bonjour!",
            "success_criteria": "Order lunch clearly.",
            "vocabulary_domain": ["food", "restaurant"],
            "max_turns": 12,
        },
    )

    recommendation, updated_profile = await coach.analyze_session(
        user_id="default-user",
        conversation_history=[{"role": "user", "content": "Bonjour, je veux un cafe"}],
        scenario={
            "title": "Ordering Lunch in Paris",
            "target_language": "fr",
            "difficulty": "beginner",
            "setting": "A Paris bistro.",
            "npc_role": "A friendly waiter",
            "npc_personality": "Warm and patient",
            "opening_line": "Bonjour!",
            "success_criteria": "Order lunch clearly.",
            "vocabulary_domain": ["food", "restaurant"],
            "max_turns": 12,
        },
        evaluation=evaluation,
        prior_profile=prior_profile,
    )

    assert recommendation.recommended_difficulty in {"beginner", "intermediate", "advanced"}
    assert recommendation.recommended_correction_mode in {"off", "gentle", "strict"}
    assert recommendation.next_scenario.target_language == "fr"
    assert recommendation.next_scenario.title != "Ordering Lunch in Paris"
    assert "follow-up" not in recommendation.next_scenario.title.lower()
    assert updated_profile.user_id == "default-user"
    assert updated_profile.last_recommended_scenario is not None


# ── Session Manager ───────────────────────────────────────

def test_session_manager_create_and_get():
    mgr = SessionManager()
    scenario = {"scenario_id": "test", "opening_line": "Bonjour!", "max_turns": 10}
    state = mgr.create_session("s1", scenario)

    assert state.session_id == "s1"
    assert len(state.conversation_history) == 1  # Opening line

    fetched = mgr.get_session("s1")
    assert fetched is not None
    assert fetched.session_id == "s1"


def test_session_manager_add_turns():
    mgr = SessionManager()
    scenario = {"scenario_id": "test", "opening_line": "", "max_turns": 5}
    state = mgr.create_session("s2", scenario)

    state.add_user_turn("Je voudrais un cafe")
    state.add_npc_turn("Bien sur! Un cafe noir?")

    assert state.turn_count == 2
    assert len(state.conversation_history) == 2


def test_session_manager_end_session():
    mgr = SessionManager()
    scenario = {"scenario_id": "test", "opening_line": "", "max_turns": 5}
    mgr.create_session("s3", scenario)

    ended = mgr.end_session("s3")
    assert ended is not None

    assert mgr.get_session("s3") is None


def test_session_manager_turn_limit():
    mgr = SessionManager()
    scenario = {"scenario_id": "test", "opening_line": "", "max_turns": 2}
    state = mgr.create_session("s4", scenario)

    for i in range(4):
        state.add_user_turn(f"turn {i}")

    assert state.is_over_turn_limit()


# ── Scenario Loader ───────────────────────────────────────

def test_scenario_loader():
    scenarios = load_scenarios("scenarios")
    assert len(scenarios) > 0


def test_get_specific_scenario():
    load_scenarios("scenarios")
    scenario = get_scenario("paris-restaurant-01")
    assert scenario is not None
    assert scenario["target_language"] == "fr"


def test_get_all_scenarios():
    load_scenarios("scenarios")
    all_scenarios = get_all_scenarios()
    assert isinstance(all_scenarios, list)
    assert len(all_scenarios) > 0
