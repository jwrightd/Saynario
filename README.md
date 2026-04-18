# Saynario

This repository contains the Saynario language-roleplay application. The main app lives in [`language-roleplayer/`](./language-roleplayer), where you'll find the FastAPI backend, React frontend, scenario definitions, and test suite.

## Repository Layout

- `language-roleplayer/` - primary application code and project documentation
- `venv/` - local virtual environment for this workspace

## What The App Does

Saynario is a voice-to-voice language practice app for roleplaying real-world scenarios like restaurant orders, transit conversations, and interviews. It combines speech-to-text, conversational AI, text-to-speech, and post-session evaluation to help learners practice spoken language.

## Quick Start

From the repository root:

```bash
cd language-roleplayer
cp .env.example .env
docker-compose up --build
```

The app will be available at `http://localhost:8000`.

## Local Development

Backend:

```bash
cd language-roleplayer
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd language-roleplayer/frontend
npm install
npm run dev
```

## Testing

```bash
cd language-roleplayer
pytest tests/ -v
```

## More Documentation

For app-specific details, architecture, scenario authoring, and service information, see [`language-roleplayer/README.md`](./language-roleplayer/README.md).
