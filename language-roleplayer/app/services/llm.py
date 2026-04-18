"""Conversational LLM service using Anthropic Claude.

V2 additions:
- Adaptive difficulty (Krashen i+1): NPC mode adjusts based on user performance.
- In-conversation correction mode (off / gentle / strict).
- Vocabulary hint extraction (lightweight secondary call).
- Sentence-level streaming markers for reduced TTS latency.
"""

import logging
import re
from typing import AsyncGenerator

from app.config import get_settings

logger = logging.getLogger(__name__)

# ── System prompt templates ──────────────────────────────────

BASE_SYSTEM_PROMPT = """You are a language immersion roleplay partner. You are playing the following character:

Role: {npc_role}
Personality: {npc_personality}
Setting: {setting}
Target Language: {target_language}
Difficulty Level: {difficulty}
Current NPC Speech Mode: {npc_mode}

CORE RULES:
1. ONLY respond in {target_language}. Never use English unless the user explicitly says "hint" or "help".
2. Stay completely in character as the {npc_role} at all times.
3. Keep responses natural and conversational.

SPEECH MODE RULES (current mode: {npc_mode}):
- support: Use very simple vocabulary and short sentences (5-10 words). Speak slowly and clearly. Only use the most common words.
- natural: Use moderate vocabulary with occasional idioms. Sentences of 10-20 words. Include cultural context naturally.
- challenge: Use natural native-level speech with idioms, colloquialisms, complex grammar, and regional expressions. Speak at full speed.

DIFFICULTY-BASED LENGTH:
- beginner / support: 1-2 short sentences per response.
- intermediate / natural: 2-3 sentences per response.
- advanced / challenge: 2-4 sentences, can be complex.

HINT HANDLING:
- If the user says "hint" or "help" in English, give a helpful nudge IN THE TARGET LANGUAGE. Provide one or two words or a phrase they might need, staying in character.

SCENARIO GOAL: {success_criteria}
{spaced_repetition_instruction}
"""

CORRECTION_OFF = ""

CORRECTION_GENTLE = """
GENTLE CORRECTION MODE (active):
After the user speaks, if they made a grammar or vocabulary error, naturally incorporate the correct form into your response without explicitly pointing it out. For example: if the user said "Je veux aller à la marché", you might naturally say "Ah, vous voulez aller au marché? Bien sûr!" — echoing the correct form without saying "you made an error".
"""

CORRECTION_STRICT = """
STRICT CORRECTION MODE (active):
After the user speaks, if they made a grammar or vocabulary error, briefly and kindly point it out first, then continue the scenario. Format: "Petite correction: on dit '[correct form]' et non '[what they said]'. [Continue with scenario response]." Only correct ONE error per turn — the most important one.
"""

VOCAB_HINT_SYSTEM = """You are a language learning assistant. Given the NPC's response in {language}, extract 3-5 key vocabulary words or short phrases that a language learner should know, with their English translations. These should be words actually used in the response that are relevant to the scenario context.

Return ONLY a JSON array like:
[{{"word": "...", "translation": "...", "type": "noun|verb|phrase|adjective"}}]
No other text."""


class LLMService:
    """Claude-based conversational AI service."""

    def __init__(self):
        try:
            import anthropic
            self._anthropic = anthropic
        except ImportError as e:
            raise ImportError("anthropic package required. Run: pip install anthropic") from e

        settings = get_settings()
        self.client = self._anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.claude_model

    def _build_system_prompt(self, scenario: dict, npc_mode: str = "natural",
                              correction_mode: str = "off",
                              spaced_repetition_words: list[str] | None = None) -> str:
        sr_instruction = ""
        if spaced_repetition_words:
            words_str = ", ".join(spaced_repetition_words[:8])
            sr_instruction = (
                f"\nSPACED REPETITION: The user has previously struggled with these words. "
                f"When the scenario naturally allows, weave them in: {words_str}. "
                f"Do NOT force them in awkwardly.\n"
            )

        correction_block = {
            "off": CORRECTION_OFF,
            "gentle": CORRECTION_GENTLE,
            "strict": CORRECTION_STRICT,
        }.get(correction_mode, CORRECTION_OFF)

        return BASE_SYSTEM_PROMPT.format(
            npc_role=scenario.get("npc_role", "a friendly local"),
            npc_personality=scenario.get("npc_personality", "friendly and patient"),
            setting=scenario.get("setting", "a local establishment"),
            target_language=scenario.get("target_language", "fr"),
            difficulty=scenario.get("difficulty", "beginner"),
            npc_mode=npc_mode,
            success_criteria=scenario.get("success_criteria", "Have a natural conversation"),
            spaced_repetition_instruction=sr_instruction,
        ) + correction_block

    async def generate_response(
        self,
        conversation_history: list[dict],
        scenario: dict,
        npc_mode: str = "natural",
        correction_mode: str = "off",
        spaced_repetition_words: list[str] | None = None,
    ) -> str:
        """Generate a full (non-streaming) NPC response."""
        system_prompt = self._build_system_prompt(
            scenario, npc_mode, correction_mode, spaced_repetition_words
        )
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=500,
                system=system_prompt,
                messages=conversation_history,
            )
            text = response.content[0].text
            logger.info(f"LLM response: {text[:80]}...")
            return text
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise

    async def stream_response(
        self,
        conversation_history: list[dict],
        scenario: dict,
        npc_mode: str = "natural",
        correction_mode: str = "off",
        spaced_repetition_words: list[str] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream NPC response token by token."""
        system_prompt = self._build_system_prompt(
            scenario, npc_mode, correction_mode, spaced_repetition_words
        )
        try:
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=500,
                system=system_prompt,
                messages=conversation_history,
            ) as stream:
                async for text in stream.text_stream:
                    yield text
        except Exception as e:
            logger.error(f"Claude streaming error: {e}")
            raise

    async def extract_vocab_hints(self, npc_text: str, language: str) -> list[dict]:
        """Extract vocabulary hints from NPC text (lightweight secondary call)."""
        import json
        try:
            response = await self.client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=256,
                system=VOCAB_HINT_SYSTEM.format(language=language),
                messages=[{"role": "user", "content": npc_text}],
            )
            return self._parse_vocab_hint_payload(response.content[0].text, json)
        except Exception as e:
            logger.warning(f"Vocab hint extraction failed: {e}")
            return []

    @staticmethod
    def _parse_vocab_hint_payload(payload: str, json_module) -> list[dict]:
        payload = payload.strip()
        if payload.startswith("```"):
            payload = re.sub(r"^```(?:json)?\s*", "", payload)
            payload = re.sub(r"\s*```$", "", payload)

        try:
            return json_module.loads(payload)
        except Exception:
            match = re.search(r"\[[\s\S]*\]", payload)
            if not match:
                raise
            return json_module.loads(match.group(0))


class MockLLMService:
    """Mock LLM for testing without API keys."""

    MOCK_RESPONSES = {
        "fr": [
            "Bonjour et bienvenue! Qu'est-ce que je peux vous servir aujourd'hui?",
            "Excellent choix! Et comme boisson, qu'est-ce que vous prendrez?",
            "Très bien! Je vous apporte ça tout de suite. Autre chose?",
            "Parfait! Votre commande arrive dans quelques minutes. Bon appétit!",
        ],
        "es": [
            "Buenas tardes! Bienvenido. Qué le puedo ofrecer hoy?",
            "Excelente elección! Y para beber, qué desea?",
            "Muy bien, enseguida se lo traigo. Algo más?",
            "Perfecto! Su pedido estará listo pronto. Buen provecho!",
        ],
        "de": [
            "Guten Tag und herzlich willkommen! Was darf ich Ihnen bringen?",
            "Sehr gute Wahl! Und was möchten Sie trinken?",
            "Wunderbar! Ich bringe es Ihnen sofort. Noch etwas?",
            "Perfekt! Ihre Bestellung kommt gleich. Guten Appetit!",
        ],
        "ja": [
            "Irasshaimase! Nanmei-sama desu ka?",
            "Kashikomarimashita. Onomimono wa ikaga desu ka?",
            "Hai, sugu omochi shimasu. Hoka ni nanika gozaimasuka?",
            "Arigatou gozaimasu. Shoushoshomachi kudasai.",
        ],
    }

    MOCK_VOCAB_HINTS = {
        "fr": [
            {"word": "commander", "translation": "to order", "type": "verb"},
            {"word": "l'addition", "translation": "the bill", "type": "noun"},
            {"word": "s'il vous plaît", "translation": "please (formal)", "type": "phrase"},
        ],
        "es": [
            {"word": "pedir", "translation": "to order/ask for", "type": "verb"},
            {"word": "la cuenta", "translation": "the bill", "type": "noun"},
            {"word": "por favor", "translation": "please", "type": "phrase"},
        ],
        "de": [
            {"word": "bestellen", "translation": "to order", "type": "verb"},
            {"word": "die Rechnung", "translation": "the bill", "type": "noun"},
            {"word": "bitte", "translation": "please", "type": "phrase"},
        ],
        "ja": [
            {"word": "注文する (chūmon suru)", "translation": "to order", "type": "verb"},
            {"word": "お会計 (okaikei)", "translation": "the bill", "type": "noun"},
            {"word": "ください (kudasai)", "translation": "please give me", "type": "phrase"},
        ],
    }

    def __init__(self):
        self._turn_counters: dict[str, int] = {}

    def _get_response(self, language: str, key: str) -> str:
        responses = self.MOCK_RESPONSES.get(language, self.MOCK_RESPONSES["fr"])
        idx = self._turn_counters.get(key, 0)
        self._turn_counters[key] = idx + 1
        return responses[idx % len(responses)]

    async def generate_response(
        self,
        conversation_history: list[dict],
        scenario: dict,
        npc_mode: str = "natural",
        correction_mode: str = "off",
        spaced_repetition_words: list[str] | None = None,
    ) -> str:
        lang = scenario.get("target_language", "fr")
        return self._get_response(lang, f"{lang}-{len(conversation_history)}")

    async def stream_response(
        self,
        conversation_history: list[dict],
        scenario: dict,
        npc_mode: str = "natural",
        correction_mode: str = "off",
        spaced_repetition_words: list[str] | None = None,
    ) -> AsyncGenerator[str, None]:
        text = await self.generate_response(conversation_history, scenario)
        words = text.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")

    async def extract_vocab_hints(self, npc_text: str, language: str) -> list[dict]:
        return self.MOCK_VOCAB_HINTS.get(language, self.MOCK_VOCAB_HINTS["fr"])


def create_llm_service():
    """Factory: return the appropriate LLM service based on config."""
    settings = get_settings()
    if settings.mock_mode:
        logger.info("Using Mock LLM service")
        return MockLLMService()
    logger.info("Using Claude LLM service")
    return LLMService()
