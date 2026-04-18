/**
 * localStorage helpers for streak, XP, and vocabulary bank.
 * All functions are synchronous and safe (try/catch for storage quota errors).
 */

const KEYS = {
  STREAK: "lr_streak",
  XP: "lr_xp",
  VOCAB_BANK: "lr_vocab_bank",
  LAST_SESSION_DATE: "lr_last_session_date",
  CUSTOM_SCENARIOS: "lr_custom_scenarios",
  SESSION_HISTORY: "lr_session_history",
};

// ── Streak & XP ─────────────────────────────────────────────────────────────

/** Returns the current streak count (number of consecutive days). */
export function getStreak() {
  try {
    return parseInt(localStorage.getItem(KEYS.STREAK) || "0", 10);
  } catch {
    return 0;
  }
}

/** Returns the total accumulated XP. */
export function getXP() {
  try {
    return parseInt(localStorage.getItem(KEYS.XP) || "0", 10);
  } catch {
    return 0;
  }
}

/**
 * Call after each completed session.
 * Awards XP and updates streak if a new calendar day has started.
 * Returns { newXP, newStreak, streakBroken }.
 */
export function recordSession(xpEarned = 50) {
  try {
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem(KEYS.LAST_SESSION_DATE) || "";
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    let streak = getStreak();
    let streakBroken = false;

    if (lastDate === today) {
      // Same day — just add XP, don't change streak
    } else if (lastDate === yesterday) {
      // Consecutive day — increment streak
      streak += 1;
    } else if (lastDate === "") {
      // First ever session
      streak = 1;
    } else {
      // Missed a day — reset streak
      streak = 1;
      streakBroken = true;
    }

    const newXP = getXP() + xpEarned;
    localStorage.setItem(KEYS.STREAK, String(streak));
    localStorage.setItem(KEYS.XP, String(newXP));
    localStorage.setItem(KEYS.LAST_SESSION_DATE, today);

    return { newXP, newStreak: streak, streakBroken };
  } catch {
    return { newXP: 0, newStreak: 0, streakBroken: false };
  }
}

/** Compute XP earned from an evaluation report score (0-100 → 10-150 XP). */
export function computeXP(overallScore = 0) {
  return Math.round(10 + (overallScore / 100) * 140);
}

// ── Vocabulary Bank ──────────────────────────────────────────────────────────

/**
 * Returns the vocabulary bank as { [language]: VocabEntry[] }.
 * VocabEntry = { word, translation, type, seenAt, language }
 */
export function getVocabBank() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.VOCAB_BANK) || "{}");
  } catch {
    return {};
  }
}

/**
 * Adds vocab hints to the bank for a given language.
 * Avoids duplicates (by word, case-insensitive).
 * @param {string} language  e.g. "fr"
 * @param {Array<{word, translation, type}>} hints
 */
export function addVocabHints(language, hints) {
  if (!hints || hints.length === 0) return;
  try {
    const bank = getVocabBank();
    const existing = bank[language] || [];
    const existingWords = new Set(existing.map((e) => e.word.toLowerCase()));

    const newEntries = hints
      .filter((h) => !existingWords.has(h.word.toLowerCase()))
      .map((h) => ({ ...h, language, seenAt: new Date().toISOString() }));

    bank[language] = [...existing, ...newEntries];
    localStorage.setItem(KEYS.VOCAB_BANK, JSON.stringify(bank));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/** Returns all vocab entries as a flat array (all languages). */
export function getAllVocab() {
  const bank = getVocabBank();
  return Object.values(bank).flat();
}

/** Returns vocab entries for a specific language. */
export function getVocabForLanguage(language) {
  const bank = getVocabBank();
  return bank[language] || [];
}

/** Clears vocab for a specific language. */
export function clearVocabForLanguage(language) {
  try {
    const bank = getVocabBank();
    delete bank[language];
    localStorage.setItem(KEYS.VOCAB_BANK, JSON.stringify(bank));
  } catch {}
}

// ── Custom Scenarios ─────────────────────────────────────────────────────────

/** Returns array of user-created custom scenarios. */
export function getCustomScenarios() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.CUSTOM_SCENARIOS) || "[]");
  } catch {
    return [];
  }
}

function slugifyPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function buildScenarioId(prefix, scenario) {
  const parts = [
    scenario.target_language || "xx",
    slugifyPart(scenario.title || "scene"),
    slugifyPart(scenario.npc_role || "partner"),
  ].filter(Boolean);

  const stem = parts.join("-") || `${prefix}-${Date.now()}`;
  return `${prefix}_${stem}`.slice(0, 96);
}

function upsertCustomScenario(scenario) {
  try {
    const scenarios = getCustomScenarios();
    const now = new Date().toISOString();
    const id = scenario.id || buildScenarioId("custom", scenario);
    const existingIndex = scenarios.findIndex((item) => item.id === id);
    const existing = existingIndex >= 0 ? scenarios[existingIndex] : null;
    const saved = {
      ...existing,
      ...scenario,
      id,
      isCustom: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      scenarios.splice(existingIndex, 1);
    }

    scenarios.unshift(saved);
    localStorage.setItem(KEYS.CUSTOM_SCENARIOS, JSON.stringify(scenarios));
    return saved;
  } catch {
    return null;
  }
}

/** Saves a new custom scenario. Returns the saved scenario with generated id. */
export function saveCustomScenario(scenario) {
  return upsertCustomScenario({
    ...scenario,
    id: scenario.id || `custom_${Date.now()}`,
    createdByCoach: false,
  });
}

/** Saves or updates a coach-generated scenario in the custom scenario shelf. */
export function saveCoachScenario(scenario, sourceScenario = null) {
  return upsertCustomScenario({
    ...scenario,
    id: scenario.id || buildScenarioId("coach", scenario),
    createdByCoach: true,
    coachSourceScenarioTitle: sourceScenario?.title || "",
    coachCreatedAt: new Date().toISOString(),
  });
}

/** Deletes a custom scenario by id. */
export function deleteCustomScenario(id) {
  try {
    const scenarios = getCustomScenarios().filter((s) => s.id !== id);
    localStorage.setItem(KEYS.CUSTOM_SCENARIOS, JSON.stringify(scenarios));
  } catch {}
}

// ── Session History ──────────────────────────────────────────────────────────

/**
 * Returns the last 50 completed session records, newest first.
 * Each record: { id, scenarioTitle, language, difficulty, completedAt, evaluation, transcript, scenarioInfo }
 */
export function getSessionHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.SESSION_HISTORY) || "[]");
  } catch {
    return [];
  }
}

/** Saves a completed session record (prepends, keeps last 50). */
export function saveSessionRecord(record) {
  try {
    const history = getSessionHistory();
    const updated = [record, ...history].slice(0, 50);
    localStorage.setItem(KEYS.SESSION_HISTORY, JSON.stringify(updated));
  } catch {}
}

/** Deletes a session record by id. */
export function deleteSessionRecord(id) {
  try {
    const history = getSessionHistory().filter((s) => s.id !== id);
    localStorage.setItem(KEYS.SESSION_HISTORY, JSON.stringify(history));
  } catch {}
}
