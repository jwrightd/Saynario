"""Fluency evaluation engine — runs at the end of a conversation session."""

import json
import logging
from typing import Optional

from app.config import get_settings
from app.models.schemas import EvaluationReport

logger = logging.getLogger(__name__)


EVALUATION_SYSTEM_PROMPT = """You are an expert language assessment evaluator. You will receive a conversation transcript
between a language learner (role: "user") and a native-speaking NPC (role: "assistant") conducted in {target_language}.

The learner's native language is English. The scenario was: {setting}
Difficulty level: {difficulty}
The success criteria was: {success_criteria}

Analyze ONLY the user's turns (the learner's speech). Evaluate their performance and return a JSON object
with exactly these fields:

{{
  "overall_score": <float 0-100>,
  "cefr_estimate": "<A1|A2|B1|B2|C1|C2>",
  "vocabulary_score": <float 0-100>,
  "naturalness_score": <float 0-100>,
  "task_completion": <true|false>,
  "grammar_errors": [
    {{
      "original": "<what the user said>",
      "corrected": "<correct version>",
      "rule": "<grammar rule name>",
      "explanation": "<brief explanation in English>"
    }}
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvement_areas": ["<area 1>", "<area 2>"],
  "suggested_vocabulary": ["<word/phrase 1>", "<word/phrase 2>"],
  "cultural_notes": "<one or two sentences about a cultural nuance relevant to this scenario, or null if not applicable>"
}}

Be thorough but fair. For beginners, weight effort and communication success highly.
For advanced learners, weight accuracy and naturalness more heavily.
Return ONLY the JSON object, no additional text.
"""


class EvaluationService:
    """Evaluates conversation transcripts using Claude."""

    def __init__(self):
        import anthropic
        settings = get_settings()
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model = settings.claude_model

    async def evaluate(
        self,
        conversation_history: list[dict],
        scenario: dict,
    ) -> EvaluationReport:
        """Run the full evaluation pipeline on a completed conversation."""

        system_prompt = EVALUATION_SYSTEM_PROMPT.format(
            target_language=scenario.get("target_language", "fr"),
            setting=scenario.get("setting", "general conversation"),
            difficulty=scenario.get("difficulty", "beginner"),
            success_criteria=scenario.get("success_criteria", "have a natural conversation"),
        )

        # Build transcript text for the evaluation prompt
        transcript_text = self._format_transcript(conversation_history)

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=2000,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": f"Here is the conversation transcript:\n\n{transcript_text}"}
                ],
            )

            result_text = response.content[0].text.strip()

            # Parse JSON from response (handle potential markdown code blocks)
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
                result_text = result_text.strip()

            report_data = json.loads(result_text)
            report = EvaluationReport(**report_data)

            logger.info(f"Evaluation complete: score={report.overall_score}, cefr={report.cefr_estimate}")
            return report

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse evaluation JSON: {e}")
            return self._fallback_report()
        except Exception as e:
            logger.error(f"Evaluation error: {e}")
            raise

    def _format_transcript(self, conversation_history: list[dict]) -> str:
        lines = []
        for msg in conversation_history:
            role = "Learner" if msg["role"] == "user" else "NPC"
            lines.append(f"[{role}]: {msg['content']}")
        return "\n".join(lines)

    def _fallback_report(self) -> EvaluationReport:
        return EvaluationReport(
            overall_score=50.0,
            cefr_estimate="A2",
            vocabulary_score=50.0,
            naturalness_score=50.0,
            task_completion=False,
            grammar_errors=[],
            strengths=["Attempted to communicate in the target language"],
            improvement_areas=["Evaluation could not be completed — try again"],
            suggested_vocabulary=[],
        )


class MockEvaluationService:
    """Mock evaluation for testing."""

    async def evaluate(
        self,
        conversation_history: list[dict],
        scenario: dict,
    ) -> EvaluationReport:
        logger.info("Mock evaluation running...")

        return EvaluationReport(
            overall_score=72.5,
            cefr_estimate="B1",
            vocabulary_score=68.0,
            naturalness_score=65.0,
            task_completion=True,
            grammar_errors=[
                {
                    "original": "Je voudrais un cafe noir",
                    "corrected": "Je voudrais un cafe noir, s'il vous plait",
                    "rule": "Politeness convention",
                    "explanation": "In French, it is customary to add 's'il vous plait' when ordering.",
                },
                {
                    "original": "Le cafe est tres bon",
                    "corrected": "Le cafe est tres bon",
                    "rule": "No error",
                    "explanation": "This sentence is grammatically correct. Well done!",
                },
            ],
            strengths=[
                "Good use of basic ordering vocabulary",
                "Appropriate greeting and farewell",
                "Successfully completed the ordering task",
            ],
            improvement_areas=[
                "Practice using polite forms (s'il vous plait, merci)",
                "Try using more varied adjectives to describe preferences",
                "Work on question formation for asking about menu items",
            ],
            suggested_vocabulary=[
                "l'addition (the bill)",
                "l'eau gazeuse (sparkling water)",
                "saignant/a point/bien cuit (rare/medium/well done)",
                "qu'est-ce que vous recommandez? (what do you recommend?)",
            ],
            cultural_notes="In French restaurants, it is customary to greet the staff with 'Bonjour' upon entering, and to ask for the bill explicitly — it will not be brought automatically as a sign of respect for your time.",
        )


def create_evaluation_service():
    """Factory: create the appropriate evaluation service."""
    settings = get_settings()
    if settings.mock_mode:
        logger.info("Using Mock Evaluation service")
        return MockEvaluationService()
    else:
        logger.info("Using Claude Evaluation service")
        return EvaluationService()
