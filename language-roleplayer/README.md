# Saynario

Saynario is a voice-to-voice AI agent that roleplays real-world scenarios (ordering food in Paris, interviewing in Tokyo, etc.) and provides a fluency score with grammar corrections at the end of each conversation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| STT | OpenAI Whisper (API or local) |
| LLM | Anthropic Claude (Sonnet 4) |
| TTS | ElevenLabs Multilingual v2 |
| VAD | Silero VAD |
| Backend | FastAPI + WebSockets |
| Frontend | React + Vite |
| Database | PostgreSQL |
| Cache | Redis |

## Quick Start

### 1. Clone and configure

```bash
git clone <repo-url> && cd language-roleplayer
cp .env.example .env
# Fill in your API keys in .env
```

### 2. Run with Docker (recommended)

```bash
docker-compose up --build
# App available at http://localhost:8000
```

### 3. Run locally (development)

**Backend:**
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend && npm install && npm run dev
# Frontend at http://localhost:3000 (proxies to backend)
```

### 4. Mock mode (no API keys needed)

Set `MOCK_MODE=true` in `.env` to run with stubbed services for testing.

## Project Structure

```
language-roleplayer/
  app/
    main.py              # FastAPI entry point
    config.py            # Environment config
    models/
      database.py        # SQLAlchemy models
      schemas.py         # Pydantic schemas
    routes/
      scenarios.py       # GET /api/scenarios
      sessions.py        # POST /api/sessions, POST /sessions/{id}/end
      users.py           # GET /api/users/{id}/progress
      websocket.py       # WS /ws/session/{id}
    services/
      stt.py             # Whisper speech-to-text
      llm.py             # Claude conversational AI
      tts.py             # ElevenLabs text-to-speech
      vad.py             # Silero voice activity detection
      evaluation.py      # Post-session fluency evaluation
      session_manager.py # In-memory session state
      scenario_loader.py # YAML scenario loader
  frontend/
    src/
      App.jsx
      pages/             # ScenarioBrowser, ConversationPage
      components/        # ScenarioCard, EvaluationReport
      hooks/             # useConversation, useAudioRecorder
      utils/api.js       # API client
  scenarios/             # YAML scenario configs by language
  tests/                 # pytest test suite
  Dockerfile
  docker-compose.yml
```

## Adding Scenarios

Create a YAML file in `scenarios/{language_code}/`:

```yaml
scenario_id: unique-id
title: "Display Title"
target_language: fr
difficulty: beginner  # beginner | intermediate | advanced
setting: "Description of the physical setting..."
npc_role: "A friendly waiter named Pierre"
npc_personality: "Warm and patient"
vocabulary_domain: [food, drinks, restaurant]
max_turns: 15
opening_line: "Bonjour! Qu'est-ce que je peux vous servir?"
success_criteria: "Order a main dish and a drink"
```

Validate: `python scripts/validate_scenario.py scenarios/fr/new-scenario.yaml`

## Tests

```bash
pytest tests/ -v
```
