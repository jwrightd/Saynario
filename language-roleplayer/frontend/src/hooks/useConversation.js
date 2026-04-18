/**
 * Custom hook managing the WebSocket conversation lifecycle.
 * V2: Handles vocab_hints, difficulty_change, correction mode, and audio ordering by seq.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createConversationSocket } from '../utils/api';
import { addVocabHints, saveCoachScenario, saveSessionRecord } from '../utils/storage';

export default function useConversation(sessionId) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isNpcSpeaking, setIsNpcSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [coach, setCoach] = useState(null);
  const [learnerProfile, setLearnerProfile] = useState(null);
  const [scenarioInfo, setScenarioInfo] = useState(null);
  const [error, setError] = useState(null);

  // V2 state
  const [vocabHints, setVocabHints] = useState([]);
  const [difficultyMode, setDifficultyMode] = useState(null);
  const [difficultyMessage, setDifficultyMessage] = useState(null);
  const [correctionMode, setCorrectionModeState] = useState('off');

  // Audio replay cache: { [turnId]: base64[] sorted by seq }
  const [audioCache, setAudioCache] = useState({});

  const wsRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const npcBufferRef = useRef('');
  const messagesRef = useRef([]);
  const scenarioInfoRef = useRef(null);
  const sessionSavedRef = useRef(false);
  const npcTurnIdRef = useRef(0);
  const pendingAudioRef = useRef([]); // { seq, audio } for the current NPC turn

  // ── Reset all state when session changes (same-route navigation) ────────────
  useEffect(() => {
    setMessages([]);
    setIsConnected(false);
    setIsNpcSpeaking(false);
    setIsProcessing(false);
    setEvaluation(null);
    setCoach(null);
    setLearnerProfile(null);
    setScenarioInfo(null);
    setError(null);
    setVocabHints([]);
    setDifficultyMode(null);
    setDifficultyMessage(null);
    setCorrectionModeState('off');
    setIsEvaluating(false);
    setAudioCache({});
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    npcBufferRef.current = '';
    npcTurnIdRef.current = 0;
    pendingAudioRef.current = [];
    scenarioInfoRef.current = null;
    sessionSavedRef.current = false;
  }, [sessionId]);

  // ── Audio playback — sequential queue, ordered by seq ──────────────────────
  const playNextAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsNpcSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsNpcSpeaking(true);

    audioQueueRef.current.sort((a, b) => a.seq - b.seq);
    const { audio: audioData } = audioQueueRef.current.shift();

    const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
    audio.onended = () => playNextAudio();
    audio.onerror = () => playNextAudio();
    audio.play().catch(() => playNextAudio());
  }, []);

  const queueAudio = useCallback((base64Audio, seq) => {
    audioQueueRef.current.push({ audio: base64Audio, seq });
    if (!isPlayingRef.current) {
      setTimeout(() => {
        if (!isPlayingRef.current) playNextAudio();
      }, 80);
    }
  }, [playNextAudio]);

  // Snapshot pending audio and store it for the given turnId after delayMs.
  // Clears pendingAudioRef so the next turn starts fresh.
  const cacheTurnAudio = useCallback((turnId, delayMs) => {
    setTimeout(() => {
      const chunks = [...pendingAudioRef.current]
        .sort((a, b) => a.seq - b.seq)
        .map(c => c.audio);
      pendingAudioRef.current = [];
      if (chunks.length > 0) {
        setAudioCache(prev => ({ ...prev, [turnId]: chunks }));
      }
    }, delayMs);
  }, []);

  // ── WebSocket message handler ───────────────────────────────────────────────
  const handleMessage = useCallback((event) => {
    const msg = JSON.parse(event.data);
    const { type, data } = msg;

    switch (type) {
      case 'session_started': {
        scenarioInfoRef.current = data.scenario;
        sessionSavedRef.current = false;
        setEvaluation(null);
        setCoach(null);
        setLearnerProfile(null);
        setScenarioInfo(data.scenario);
        if (data.scenario?.difficulty) {
          setDifficultyMode(
            data.scenario.difficulty === 'beginner' ? 'support' : 'natural'
          );
        }
        if (data.opening_line) {
          const openingTurnId = npcTurnIdRef.current++;
          setMessages(prev => [
            ...prev,
            { role: 'npc', text: data.opening_line, turnId: openingTurnId },
          ]);
          // Opening line audio arrives shortly after session_started; give it 1500ms
          cacheTurnAudio(openingTurnId, 1500);
        }
        break;
      }

      case 'transcription':
        setMessages((prev) => [
          ...prev,
          { role: 'user', text: data.text },
        ]);
        setIsProcessing(true);
        break;

      case 'npc_text':
        if (data.is_final) {
          const finalText = data.text;
          const turnId = npcTurnIdRef.current++;
          setMessages((prev) => {
            const filtered = prev.filter((m) => !m.streaming);
            return [...filtered, { role: 'npc', text: finalText, turnId }];
          });
          npcBufferRef.current = '';
          setIsProcessing(false);
          // Sentence-level TTS audio may still be arriving; collect for 600ms
          cacheTurnAudio(turnId, 600);
        } else {
          npcBufferRef.current += data.text;
          const current = npcBufferRef.current;
          setMessages((prev) => {
            const filtered = prev.filter((m) => !m.streaming);
            return [...filtered, { role: 'npc', text: current, streaming: true }];
          });
        }
        break;

      case 'npc_audio':
        queueAudio(data.audio, data.seq ?? 0);
        // Also accumulate for replay cache
        pendingAudioRef.current.push({ seq: data.seq ?? 0, audio: data.audio });
        break;

      case 'vocab_hints':
        if (data.hints && data.hints.length > 0) {
          setVocabHints(data.hints);
          setScenarioInfo((si) => {
            if (si?.target_language) {
              addVocabHints(si.target_language, data.hints);
            }
            return si;
          });
        }
        break;

      case 'difficulty_change':
        setDifficultyMode(data.new_mode);
        setDifficultyMessage(data.message);
        setTimeout(() => setDifficultyMessage(null), 4000);
        setMessages((prev) => [
          ...prev,
          { role: 'system', text: `🎯 ${data.message}`, isDifficulty: true },
        ]);
        break;

      case 'evaluation':
        if (!sessionSavedRef.current) {
          sessionSavedRef.current = true;
          const si = scenarioInfoRef.current;
          const savedCoachScenario = data.coach?.next_scenario
            ? saveCoachScenario(data.coach.next_scenario, si)
            : null;
          saveSessionRecord({
            id: `session_${Date.now()}`,
            scenarioTitle: si?.title || 'Conversation',
            language: si?.target_language || 'fr',
            difficulty: si?.difficulty || 'beginner',
            completedAt: new Date().toISOString(),
            evaluation: data.report,
            coach: data.coach || null,
            learnerProfile: data.learner_profile || null,
            savedCoachScenarioId: savedCoachScenario?.id || null,
            transcript: messagesRef.current.filter((m) => !m.streaming),
            scenarioInfo: si,
          });
        }
        setEvaluation(data.report);
        setCoach(data.coach || null);
        setLearnerProfile(data.learner_profile || null);
        setIsProcessing(false);
        setIsEvaluating(false);
        break;

      case 'error':
        setError(data.message);
        setIsProcessing(false);
        break;

      default:
        console.warn('Unknown WS message type:', type);
    }
  }, [queueAudio, cacheTurnAudio]);

  // ── Connect WebSocket ───────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!sessionId) return;

    const ws = createConversationSocket(sessionId);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
      setIsConnected(false);
    };
  }, [sessionId, handleMessage]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const sendAudioChunk = useCallback((base64Audio) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'audio_chunk',
        data: { audio: base64Audio },
      }));
    }
  }, []);

  const sendAudioEnd = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'user_action',
        data: { action: 'audio_end' },
      }));
    }
  }, []);

  const sendTextInput = useCallback((text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'text_input',
        data: { text },
      }));
      setIsProcessing(true);
    }
  }, []);

  const requestHint = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'user_action',
        data: { action: 'hint' },
      }));
      setMessages((prev) => [
        ...prev,
        { role: 'system', text: '💡 Requesting a hint...' },
      ]);
      setIsProcessing(true);
    }
  }, []);

  const setCorrectionMode = useCallback((mode) => {
    setCorrectionModeState(mode);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'user_action',
        data: { action: 'set_correction_mode', value: mode },
      }));
    }
  }, []);

  const endSessionWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'user_action',
        data: { action: 'end' },
      }));
      setIsProcessing(true);
      setIsEvaluating(true);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (sessionId) connect();
    return () => disconnect();
  }, [sessionId, connect, disconnect]);

  return {
    messages,
    isConnected,
    isNpcSpeaking,
    isProcessing,
    isEvaluating,
    evaluation,
    coach,
    learnerProfile,
    scenarioInfo,
    error,
    audioCache,
    vocabHints,
    difficultyMode,
    difficultyMessage,
    correctionMode,
    setCorrectionMode,
    sendAudioChunk,
    sendAudioEnd,
    sendTextInput,
    requestHint,
    endSession: endSessionWs,
    disconnect,
  };
}
