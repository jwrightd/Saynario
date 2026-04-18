"""WebSocket handler for real-time voice conversation sessions.

V2 improvements:
- Adaptive difficulty (Krashen i+1): NPC mode auto-adjusts every N turns.
- Sentence-level TTS streaming: TTS starts on first complete sentence.
- In-conversation correction modes (off/gentle/strict).
- Vocab hint extraction runs concurrently after each NPC turn.
- Barge-in support via is_npc_speaking flag.
"""

import asyncio
import base64
import json
import logging
import re

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.session_manager import get_session_manager
from app.services.stt import create_stt_service
from app.services.llm import create_llm_service
from app.services.tts import create_tts_service, split_into_sentences
from app.services.vad import create_vad_service
from app.services.session_completion import run_session_completion
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


async def send_json(ws: WebSocket, msg_type: str, data: dict):
    """Send a typed JSON message over WebSocket."""
    try:
        await ws.send_json({"type": msg_type, "data": data})
    except Exception as e:
        logger.warning(f"Failed to send {msg_type}: {e}")


def estimate_difficulty_mode(user_turns: list[str], current_mode: str) -> tuple[str, bool]:
    """
    Estimate NPC speech mode based on user performance (Krashen i+1).

    Returns (new_mode, changed) where changed is True if mode adjusted.
    """
    if not user_turns:
        return current_mode, False

    # Simple heuristics: average word count and sentence complexity
    avg_words = sum(len(t.split()) for t in user_turns) / len(user_turns)
    avg_chars = sum(len(t) for t in user_turns) / len(user_turns)

    # Score: higher = user is performing well
    performance = (avg_words * 3 + avg_chars * 0.5) / 4

    if performance > 30 and current_mode == "support":
        return "natural", True
    elif performance > 55 and current_mode == "natural":
        return "challenge", True
    elif performance < 15 and current_mode == "natural":
        return "support", True
    elif performance < 25 and current_mode == "challenge":
        return "natural", True

    return current_mode, False


@router.websocket("/ws/session/{session_id}")
async def conversation_websocket(ws: WebSocket, session_id: str):
    """
    Main WebSocket endpoint for a conversation session.

    Client → Server messages:
      {"type": "audio_chunk", "data": {"audio": "<base64>"}}
      {"type": "text_input",  "data": {"text": "..."}}
      {"type": "user_action", "data": {"action": "hint"|"end"|"audio_end"|"set_correction_mode", "value": "..."}}

    Server → Client messages:
      {"type": "session_started",  "data": {"opening_line", "scenario"}}
      {"type": "transcription",    "data": {"text", "language"}}
      {"type": "npc_text",         "data": {"text", "is_final"}}
      {"type": "npc_audio",        "data": {"audio": "<base64>", "seq"}}
      {"type": "vocab_hints",      "data": {"hints": [{"word","translation","type"}]}}
      {"type": "difficulty_change","data": {"new_mode", "message"}}
      {"type": "evaluation",       "data": {"report": {...}}}
      {"type": "error",            "data": {"code", "message"}}
    """
    await ws.accept()

    manager = get_session_manager()
    state = manager.get_session(session_id)

    if not state:
        await send_json(ws, "error", {
            "code": "SESSION_NOT_FOUND",
            "message": "Session not found. Create one via POST /api/sessions first."
        })
        await ws.close()
        return

    settings = get_settings()
    stt = create_stt_service()
    llm = create_llm_service()
    tts = create_tts_service()
    vad = create_vad_service()

    scenario = state.scenario
    language = scenario.get("target_language", "fr")
    difficulty = scenario.get("difficulty", "beginner")

    # V2 state
    npc_mode = "support" if difficulty == "beginner" else "natural"
    correction_mode = "off"
    audio_seq = 1
    audio_buffer = b""
    user_turn_texts: list[str] = []  # For adaptive difficulty tracking

    # Determine opening line — generate in-language if the scenario has none
    opening = scenario.get("opening_line", "").strip()
    if not opening:
        opening = await llm.generate_opening_line(scenario)
        # Keep session history consistent with the generated line
        if opening and state.conversation_history and state.conversation_history[0].get("role") == "assistant":
            state.conversation_history[0]["content"] = opening

    # Send session started
    await send_json(ws, "session_started", {
        "opening_line": opening,
        "scenario": {
            "title": scenario.get("title", ""),
            "setting": scenario.get("setting", ""),
            "npc_role": scenario.get("npc_role", ""),
            "difficulty": difficulty,
            "target_language": language,
            "max_turns": scenario.get("max_turns", 20),
        },
    })

    if opening:
        try:
            opening_audio = await tts.synthesize(opening, language, scenario.get("voice_id", ""))
            await send_json(ws, "npc_audio", {
                "audio": base64.b64encode(opening_audio).decode(),
                "seq": audio_seq,
            })
            audio_seq += 1

            # Vocab hints for opening line
            async def send_opening_hints():
                hints = await llm.extract_vocab_hints(opening, language)
                if hints:
                    await send_json(ws, "vocab_hints", {"hints": hints})
            asyncio.create_task(send_opening_hints())

        except Exception as e:
            logger.error(f"TTS error on opening line: {e}")

    async def process_user_text(user_text: str):
        """
        Core pipeline: user text → LLM (streaming) → sentence-level TTS.
        Returns the full NPC response text.
        """
        nonlocal audio_seq, npc_mode, user_turn_texts

        await send_json(ws, "transcription", {"text": user_text, "language": language})
        state.add_user_turn(user_text)
        user_turn_texts.append(user_text)

        # V2: Adaptive difficulty every N turns
        check_every = settings.adaptive_check_every_n_turns
        user_count = len([m for m in state.conversation_history if m["role"] == "user"])
        if user_count > 0 and user_count % check_every == 0:
            recent = user_turn_texts[-check_every:]
            new_mode, changed = estimate_difficulty_mode(recent, npc_mode)
            if changed:
                npc_mode = new_mode
                mode_labels = {
                    "support": "Simplifying for you",
                    "natural": "Back to standard pace",
                    "challenge": "Stepping it up!",
                }
                await send_json(ws, "difficulty_change", {
                    "new_mode": npc_mode,
                    "message": mode_labels.get(npc_mode, "Adjusting difficulty..."),
                })

        # Check turn limit
        if state.is_over_turn_limit():
            await _send_evaluation()
            return ""

        # V2: Sentence-level TTS streaming
        full_response = ""
        sentence_buffer = ""
        tts_tasks = []

        async for token in llm.stream_response(
            state.conversation_history, scenario,
            npc_mode=npc_mode,
            correction_mode=correction_mode,
        ):
            full_response += token
            sentence_buffer += token
            await send_json(ws, "npc_text", {"text": token, "is_final": False})

            # Check for sentence boundary
            if settings.sentence_streaming_enabled:
                if re.search(r'[.!?…]\s', sentence_buffer) or (
                    len(sentence_buffer) > 120 and sentence_buffer.endswith((" ", "\n"))
                ):
                    sentences = split_into_sentences(sentence_buffer)
                    if sentences:
                        for sent in sentences:
                            if len(sent) >= settings.min_sentence_chars_for_tts:
                                seq_copy = audio_seq
                                audio_seq += 1

                                async def _tts_chunk(text=sent, seq=seq_copy):
                                    try:
                                        audio = await tts.synthesize(text, language, scenario.get("voice_id", ""))
                                        await send_json(ws, "npc_audio", {
                                            "audio": base64.b64encode(audio).decode(),
                                            "seq": seq,
                                        })
                                    except Exception as ex:
                                        logger.error(f"TTS chunk error: {ex}")

                                tts_tasks.append(asyncio.create_task(_tts_chunk()))
                        sentence_buffer = ""

        await send_json(ws, "npc_text", {"text": full_response, "is_final": True})

        # TTS any remaining sentence buffer
        if sentence_buffer.strip() and len(sentence_buffer.strip()) >= settings.min_sentence_chars_for_tts:
            try:
                audio = await tts.synthesize(sentence_buffer.strip(), language, scenario.get("voice_id", ""))
                await send_json(ws, "npc_audio", {
                    "audio": base64.b64encode(audio).decode(),
                    "seq": audio_seq,
                })
                audio_seq += 1
            except Exception as e:
                logger.error(f"TTS final chunk error: {e}")
        elif not tts_tasks and full_response.strip():
            # Fallback: if no sentence boundaries were hit (very short response), TTS the whole thing
            try:
                audio = await tts.synthesize(full_response.strip(), language, scenario.get("voice_id", ""))
                await send_json(ws, "npc_audio", {
                    "audio": base64.b64encode(audio).decode(),
                    "seq": audio_seq,
                })
                audio_seq += 1
            except Exception as e:
                logger.error(f"TTS error: {e}")

        # Wait for any in-flight TTS tasks
        if tts_tasks:
            await asyncio.gather(*tts_tasks, return_exceptions=True)

        state.add_npc_turn(full_response)

        # V2: Vocab hints (non-blocking concurrent call)
        async def send_hints():
            hints = await llm.extract_vocab_hints(full_response, language)
            if hints:
                await send_json(ws, "vocab_hints", {"hints": hints})
        asyncio.create_task(send_hints())

        return full_response

    async def _send_evaluation():
        """Run evaluation and close the connection."""
        completion = await run_session_completion(session_id, state)
        await send_json(
            ws,
            "evaluation",
            {
                "report": completion.evaluation.model_dump(mode="json"),
                "coach": completion.coach.model_dump(mode="json"),
                "learner_profile": completion.learner_profile.model_dump(mode="json"),
            },
        )
        manager.end_session(session_id)
        try:
            await ws.close()
        except Exception:
            pass

    async def flush_audio_buffer():
        nonlocal audio_buffer

        if not audio_buffer:
            vad.reset()
            return

        try:
            user_text = await stt.transcribe(audio_buffer, language)
            audio_buffer = b""
            vad.reset()
            if user_text.strip():
                await process_user_text(user_text.strip())
        except Exception as e:
            logger.error(f"STT pipeline error: {e}")
            await send_json(ws, "error", {
                "code": "PIPELINE_ERROR",
                "message": "Could not process audio. Please try again."
            })
            audio_buffer = b""
            vad.reset()

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type", "")
            msg_data = msg.get("data", {})

            # ── End session ──────────────────────────────
            if msg_type == "user_action" and msg_data.get("action") == "end":
                await _send_evaluation()
                return

            # ── Set correction mode ──────────────────────
            elif msg_type == "user_action" and msg_data.get("action") == "set_correction_mode":
                correction_mode = msg_data.get("value", "off")
                logger.info(f"Correction mode set to: {correction_mode}")

            # ── Force audio flush on stop-recording ─────
            elif msg_type == "user_action" and msg_data.get("action") == "audio_end":
                await flush_audio_buffer()

            # ── Hint ────────────────────────────────────
            elif msg_type == "user_action" and msg_data.get("action") == "hint":
                state.add_user_turn("hint")
                await process_user_text("hint")

            # ── Text input (fallback / testing) ──────────
            elif msg_type == "text_input":
                user_text = msg_data.get("text", "").strip()
                if user_text:
                    await process_user_text(user_text)

            # ── Audio chunk ──────────────────────────────
            elif msg_type == "audio_chunk":
                audio_b64 = msg_data.get("audio", "")
                if not audio_b64:
                    continue
                try:
                    chunk = base64.b64decode(audio_b64, validate=True)
                except Exception:
                    logger.warning("Received invalid base64 audio chunk")
                    await send_json(ws, "error", {
                        "code": "INVALID_AUDIO",
                        "message": "Audio chunk was not valid."
                    })
                    continue
                audio_buffer += chunk

                vad_result = vad.process_chunk(chunk)
                if vad_result["speech_ended"] and len(audio_buffer) > 0:
                    await flush_audio_buffer()

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error in session {session_id}: {e}", exc_info=True)
        try:
            await send_json(ws, "error", {"code": "INTERNAL_ERROR", "message": str(e)})
        except Exception:
            pass
