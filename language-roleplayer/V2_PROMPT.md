# Saynario — V2.0 Build Prompt

## Context

You are building Version 2.0 of a voice-to-voice AI language learning application. The existing V1.0 codebase is in the current working directory. It is a FastAPI backend + React frontend that lets users practice a foreign language by speaking with an AI NPC in roleplay scenarios (ordering food in Paris, job interview in Tokyo, etc.) and receiving a fluency score at the end.

**The codebase has known issues.** Do not assume any component works. Your job is to fix everything, then improve everything.

---

## Phase 1: Diagnose and Fix All Broken Components

Start here before writing any new code.

### 1.1 — Dependency Audit and Fix

The app currently fails with `ModuleNotFoundError: No module named 'anthropic'`. Assume this is not the only broken dependency. Do the following:

1. Read `requirements.txt` and audit every package for compatibility issues, version conflicts, and missing dependencies.
2. Create a clean virtual environment: `python -m venv venv && source venv/bin/activate`
3. Run `pip install -r requirements.txt` and resolve every install error before moving on.
4. Some packages (`torch`, `silero-vad`, `openai-whisper`) are very large. For the V2 MVP, make all heavy ML packages **optional** — the app must be able to start and fully function in `MOCK_MODE=true` without PyTorch or Whisper installed. Restructure imports in `app/services/vad.py` and `app/services/stt.py` with lazy loading: import inside the class constructor, not at the top of the file, wrapped in a `try/except ImportError` that falls back gracefully.

### 1.2 — Backend Smoke Test

After fixing dependencies:

1. Start the backend: `MOCK_MODE=true uvicorn app.main:app --reload --port 8000`
2. Verify each endpoint returns the correct status code:
   - `GET /api/health` → 200
   - `GET /api/scenarios` → 200, non-empty list
   - `GET /api/scenarios/paris-restaurant-01` → 200
   - `POST /api/sessions` with `{"scenario_id": "paris-restaurant-01", "user_id": "test"}` → 200
3. Fix every error until all four pass.

### 1.3 — WebSocket Pipeline Test

1. Write a standalone Python test script `scripts/test_websocket.py` that:
   - Creates a session via the REST API
   - Connects to `ws://localhost:8000/ws/session/{session_id}`
   - Sends a `text_input` message with a sample sentence in the target language
   - Asserts it receives a `transcription` message, then a `npc_text` message, then an `npc_audio` message
   - Sends a `user_action: end` message
   - Asserts it receives an `evaluation` message
   - Prints PASS or FAIL with details
2. Run the script with `MOCK_MODE=true`. Fix any WebSocket errors until it passes end-to-end.

### 1.4 — Frontend Build Test

1. `cd frontend && npm install` — resolve all dependency errors.
2. `npm run dev` — the dev server must start without errors.
3. Open the app in the browser and verify: the scenario browser loads and shows at least one scenario card. Fix any console errors until the page renders correctly.
4. Click a scenario card — verify it creates a session and navigates to the conversation page.
5. Type a message in the text input field — verify a response appears in the transcript. Fix any WebSocket or rendering errors.

### 1.5 — Run the Full Test Suite

Run `pytest tests/ -v` from the project root with `MOCK_MODE=true`. Fix every failing test. Add new tests for any regression you found and fixed in phases 1.1–1.4.

---

## Phase 2: UI Redesign

Completely replace the existing CSS and component styling. The V1 UI is minimal and unpolished. V2 must feel like a premium language learning product.

### Design System

Implement a consistent design system with these exact tokens as CSS variables:

```
Primary dark:     #0D1B2A  (near-black navy, used for headers/navbars)
Primary mid:      #1B4F72  (deep blue, primary brand color)
Primary light:    #2E86C1  (interactive blue, buttons, links)
Accent gold:      #F0A500  (warm gold, used for streaks, scores, highlights)
Accent green:     #1ABC9C  (teal-green, success states, completed tasks)
Surface 1:        #FFFFFF  (cards, main backgrounds)
Surface 2:        #F4F6F8  (page background, subtle contrast)
Surface 3:        #EBF5FB  (NPC message bubbles, light highlights)
Text primary:     #1A252F
Text secondary:   #566573
Border:           #D5D8DC
Danger:           #E74C3C
```

Fonts: Use `Inter` for UI copy and `DM Sans` for conversational text (both from Google Fonts).

### Key Visual Improvements

**Navbar**: Dark navy (`#0D1B2A`) with the app logo on the left, a language selector and user progress indicator (streak flame icon + count) on the right. Smooth shadow on scroll.

**Scenario Cards**: Rich cards with a full-width gradient header (color-coded by language: French = blue/white, Spanish = red/yellow, German = black/red/gold, Japanese = red/white). Show the flag emoji large, the NPC avatar as an illustrated icon, difficulty as a colored pill badge, and an estimated time to complete. On hover: lift with shadow. Cards should feel like choosing a "mission" in a game.

**Conversation Screen**: Split-panel design.
- Left panel (30%): Scenario context card showing the setting description, NPC name and avatar, difficulty, and a live turn counter (e.g., "Turn 4 of 15"). Below it, a compact "vocabulary hint" panel showing 3-5 key words for the scenario domain.
- Right panel (70%): Chat transcript with distinct NPC vs. user bubble styles. NPC bubbles: `Surface 3` background, left-aligned, with a small NPC avatar. User bubbles: `Primary light` background, white text, right-aligned. The thinking indicator (3 animated dots) should use `Accent gold`.

**Microphone Button**: Large (80px), centered at the bottom, pulsing gold ring animation when recording. Icon changes from mic to waveform animation while speaking.

**Evaluation Report Screen**: This is the "moment of triumph" — design it accordingly.
- Full-screen animated entrance (slide up from bottom)
- Large circular score gauge (SVG arc, animated fill from 0 to score on mount)
- CEFR level badge with a gradient background, large and prominent
- Score breakdown as horizontal bar charts (not just numbers)
- Grammar correction cards: original text struck through in red, corrected version in green below it, with an explanation chip
- Strengths section: green checkmark bullets on a light green card
- Vocabulary suggestions: word chips with a "+" icon, clicking copies to clipboard

### Custom Scenario Creation UI

Add a "Create Scenario" page accessible from the navbar. It must include:
- A form with fields: Language (dropdown with flags), Difficulty (3-option visual selector, not a plain select), Setting description (textarea with character count), NPC name, NPC personality description, Opening line (the first thing the NPC says), and Success goal.
- A "Preview Scenario" button that shows what the NPC's opening line will sound/look like (renders a mock NPC bubble with the opening line text).
- On submit: the scenario is saved to a user-created scenarios list in localStorage (for the MVP) and immediately appears in the scenario browser with a "Custom" badge.
- Validate all fields before allowing submission.

---

## Phase 3: V2.0 Feature Improvements

These are substantive improvements based on language learning research and the latest AI capabilities. Implement them in order.

### 3.1 — Adaptive Difficulty (Krashen's i+1)

Replace the static difficulty level (beginner/intermediate/advanced) with an adaptive system based on Krashen's Input Hypothesis: the NPC should always speak at just above the user's demonstrated level.

**Implementation:**
- Track per-session metrics: average vocabulary complexity of user turns (word frequency rank), average sentence length, grammar error rate (from evaluation data).
- Define three NPC speech modes internally: `support` (simplified, slow), `natural` (standard), and `challenge` (idiomatic, fast). The NPC starts at `support` for beginner scenarios and `natural` for others.
- After every 3 user turns, evaluate the recent turns and adjust the NPC mode up or down. Signal the mode change in the LLM system prompt: "The user is performing well. Increase your vocabulary complexity slightly and add one idiomatic expression to your next response." or "The user is struggling. Simplify your next two responses significantly."
- Display a subtle "Adjusting difficulty..." indicator in the UI when the mode changes, so the user feels the app is responsive to them.

### 3.2 — Vocabulary Tracking and Spaced Repetition

Track which words and phrases the user used incorrectly or appeared in the `suggested_vocabulary` field of an evaluation.

**Implementation:**
- After each evaluation, extract the suggested vocabulary and store it in a `vocabulary_bank` in localStorage (for the MVP), keyed by language. Each entry: `{ word, definition, last_seen, next_review, times_missed, scenario_context }`.
- In the LLM system prompt for subsequent sessions in the same language, include: "The user has previously struggled with these words. When appropriate, naturally weave them into the conversation: [list]. Do not force them in awkwardly — use them only when the scenario calls for it."
- On the evaluation screen, vocabulary suggestions now show "New word" vs. "Needs review" (if it appeared in a previous evaluation) as a badge.
- Add a simple "Vocabulary Bank" page accessible from the navbar, showing words grouped by language with their review status.

### 3.3 — Streak System and Progress Gamification

Users are 3x more likely to maintain a daily practice habit with a streak mechanic.

**Implementation:**
- Track last session date in localStorage. On app load, check if a session was completed today and yesterday. Maintain a streak counter.
- Navbar shows: a flame icon (`🔥`) followed by the streak count. On days with no session, the flame appears dim/grey.
- After completing a session (reaching the evaluation screen), show a brief "Session Complete" celebration banner above the evaluation report: animated confetti, "Day N Streak!", and the XP earned (calculated as: base 50 XP + 5 × overall_score/10 + 20 bonus if task_completion = true).
- Add a simple XP total and level system: every 500 XP = 1 level. Display current level and XP bar in the navbar. Level names are language-themed: Traveler (0), Wanderer (1), Explorer (2), Conversationalist (3), Linguist (4), Polyglot (5+).
- All progress data lives in localStorage for the MVP.

### 3.4 — Real-Time Vocabulary Hints During Conversation

During a conversation, the user should be able to see contextual vocabulary assistance without fully breaking immersion.

**Implementation:**
- In the conversation screen's left panel, show a "Vocabulary Helper" section that updates after each NPC turn. After the NPC speaks, make a lightweight secondary LLM call (can be Claude Haiku for cost/speed) that extracts 3-5 key vocabulary items from what the NPC just said that are relevant to the scenario domain, with brief English translations. Display them as word chips.
- This is non-blocking: it runs concurrently while the user is formulating their response. It does not interrupt the conversation flow.
- Add a small toggle to show/hide this panel. The setting is persisted in localStorage.

### 3.5 — Improved Latency: Sentence-Level TTS Streaming

The current implementation waits for the full LLM response before calling TTS. This causes unnecessary latency. Implement sentence-level streaming.

**Implementation:**
- As the LLM streams tokens, buffer them until a sentence boundary is detected (period, question mark, exclamation mark, or ellipsis followed by whitespace).
- As soon as a complete sentence is detected, send it to TTS immediately — do not wait for the rest of the response.
- Queue TTS audio chunks for sequential playback: sentence 1 audio starts playing while sentence 2 is still being synthesized.
- This cuts perceived latency from "wait for full response" to "wait for first sentence" — typically 3-5x faster for longer responses.
- Maintain a minimum sentence buffer length (20 characters) to avoid sending TTS single words like "Well," or "So,".

### 3.6 — ElevenLabs Conversational API (100ms Chunk Processing)

Update the TTS integration to use ElevenLabs' Conversational API with 100ms audio chunks instead of the standard API which processes 250ms chunks. This alone cuts TTS latency by more than half.

**Implementation:**
- In `app/services/tts.py`, replace the standard `text_to_speech.convert` call with the `text_to_speech.convert_as_stream` endpoint using `optimize_streaming_latency=4` (maximum optimization).
- Set `chunk_length_schedule=[50, 120, 160, 250]` — this tells ElevenLabs to start streaming after only 50 characters, then increase chunk size for subsequent sentences (better naturalness on longer speech while minimizing first-chunk latency).
- Test that audio quality is maintained. If artifacts appear, dial back to `optimize_streaming_latency=3`.

### 3.7 — In-Conversation Feedback (Synchronous Corrective Feedback)

Research shows synchronous (in-context) feedback is significantly more effective than post-session feedback. Add an optional mode where the NPC provides gentle mid-conversation corrections.

**Implementation:**
- Add a toggle on the conversation screen: "Correction Mode: Off / Gentle / Strict"
  - **Off**: No in-conversation corrections (default, fully immersive)
  - **Gentle**: After the user's turn, before the NPC's contextual response, the NPC first acknowledges the error with a natural reformulation — e.g., "Ah, vous voulez dire 'Je voudrais un café', n'est-ce pas? Oui, bien sûr!" (It repeats the correction embedded in its own speech, not by explicitly saying "You made an error".)
  - **Strict**: The NPC explicitly but kindly points out one grammar or vocabulary error per turn, gives the correction, then continues the scenario. Uses the format: "Petite correction: on dit '...' et non '...'. Continuons!"
- Implement by adding correction instructions to the LLM system prompt when either mode is enabled. Include the correction style description and examples in the system prompt.
- Persist the correction mode preference in localStorage.

---

## Phase 4: Scenario Validation and E2E Testing

After implementing all the above, verify every feature works end-to-end.

### 4.1 — Run Full Test Suite
```bash
MOCK_MODE=true pytest tests/ -v --tb=short
```
All tests must pass. Fix any failures before proceeding.

### 4.2 — Manual E2E Checklist

Execute each of the following manually in the browser with `MOCK_MODE=true`:

**Scenario Browser:**
- [ ] Page loads, scenario cards display correctly with gradient headers and badges
- [ ] Language and difficulty filters work
- [ ] "Create Scenario" button navigates to the creation form
- [ ] Custom scenario can be created and appears in the browser with "Custom" badge

**Conversation:**
- [ ] Clicking a scenario card creates a session and loads the conversation page
- [ ] Left panel shows setting, NPC info, turn counter, and vocabulary hints
- [ ] NPC opening line appears in the transcript with the correct bubble style
- [ ] Typing a message and pressing Send produces an NPC response (streamed, token by token)
- [ ] NPC audio plays after the text appears
- [ ] Vocabulary helper panel updates after each NPC turn
- [ ] Hint button sends a hint request and the NPC responds
- [ ] Correction mode toggle works (verify the NPC system prompt changes)
- [ ] Difficulty adaptation indicator appears after turn 3

**Evaluation:**
- [ ] End Session button triggers the evaluation
- [ ] Evaluation screen slides in with animation
- [ ] Score gauge animates from 0 to the final score
- [ ] Grammar correction cards show original/corrected/explanation
- [ ] Session complete banner shows with streak count and XP earned
- [ ] Navbar XP bar updates
- [ ] "Start New Session" returns to the scenario browser

**Vocabulary Bank:**
- [ ] Vocabulary Bank page shows words from completed sessions
- [ ] New vs. "Needs review" badges display correctly

### 4.3 — Docker Verification
```bash
MOCK_MODE=true docker-compose up --build
```
The Docker build must complete and the app must be fully functional at `http://localhost:8000`.

---

## Phase 5: Code Quality

Before finishing:

1. Remove all `print()` debug statements. Use the `logging` module everywhere.
2. Ensure every service module has a docstring explaining its purpose.
3. Verify the `.env.example` file documents every environment variable used.
4. Run the scenario validator on all YAML files: `python scripts/validate_scenario.py scenarios/**/*.yaml`
5. Confirm that `MOCK_MODE=true` produces no errors, no warnings about missing API keys, and a fully functional UI.

---

## What Not to Do

- Do not rewrite the core architecture. The FastAPI + WebSocket + React structure is correct. Improve it, don't replace it.
- Do not add new heavy ML model dependencies without a mock fallback.
- Do not add a database ORM migration step to the quick-start path. The app must work without a PostgreSQL instance using in-memory state.
- Do not use `localStorage` for anything security-sensitive. It is fine for streak counts, vocabulary banks, and preferences.
- Do not skip Phase 1. Everything in Phases 2-4 depends on having a working baseline.
