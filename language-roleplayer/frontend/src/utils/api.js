/**
 * API client for the Language Roleplayer backend.
 */

const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// Scenarios
export const getScenarios = (language, difficulty) => {
  const params = new URLSearchParams();
  if (language) params.set('language', language);
  if (difficulty) params.set('difficulty', difficulty);
  const qs = params.toString();
  return request(`/scenarios${qs ? `?${qs}` : ''}`);
};

export const getScenario = (id) => request(`/scenarios/${id}`);

/**
 * Create a session.
 * - scenarioId: string ID of a built-in scenario
 * - customScenario: full scenario object for user-created scenarios
 */
export const createSession = (scenarioId, customScenario = null) => {
  const body = customScenario
    ? { custom_scenario: customScenario, user_id: 'default-user' }
    : { scenario_id: scenarioId, user_id: 'default-user' };
  return request('/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

export const endSession = (sessionId) =>
  request(`/sessions/${sessionId}/end`, { method: 'POST' });

export const getTranscript = (sessionId) =>
  request(`/sessions/${sessionId}/transcript`);

// Health
export const healthCheck = () => request('/health');

// WebSocket
export function createConversationSocket(sessionId) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return new WebSocket(`${protocol}//${host}/ws/session/${sessionId}`);
}
