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
  const [evaluation, setEvaluation] = useState(null);
  const [coach, setCoach] = useState(null);
  const [learnerProfile, setLearnerProfile] = useState(null);
  const [scenarioInfo, setScenarioInfo] = useState(null);
  const [error, setError] = useState(null);

  // V2 state
  const [vocabHints, setVocabHints] = useState([]);      // latest batch of vocab hints
  const [difficultyMode, setDifficultyMode] = useState(null); // "support"|"natural"|"challenge"
  const [difficultyMessage, setDifficultyMessage] = useState(null);
  const [correctionMode, setCorrectionModeState] = useState('off');

  const wsRef = useRef(null);
  const audioQueueRef = useRef([]);  // { seq, audio } objects
  const isPlayingRef = useRef(false);
  const npcBufferRef = useRef('');
  const messagesRef = useRef([]);
  const scenarioInfoRef = useRef(null);
  const sessionSavedRef = useRef(false);

  // ── Audio playback — sequential queue, ordered by seq ──────────────────────
  const playNextAudio = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsNpcSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsNpcSpeaking(true);

    // Sort by seq to ensure correct playback order
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
      // Small delay to let concurrent TTS chunks arrive before we start sorting
      setTimeout(() => {
        if (!isPlayingRef.current) playNextAudio();
      }, 80);
    }
  }, [playNextAudio]);

  // ── WebSocket message handler ───────────────────────────────────────────────
  const handleMessage = useCallback((event) => {
    const msg = JSON.parse(event.data);
    const { type, data } = msg;

    switch (type) {
      case 'session_started':
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
          setMessages((prev) => [
            ...prev,
            { role: 'npc', text: data.opening_line },
          ]);
        }
        break;

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
          setMessages((prev) => {
            const filtered = prev.filter((m) => !m.streaming);
            return [...filtered, { role: 'npc', text: finalText }];
          });
          npcBufferRef.current = '';
          setIsProcessing(false);
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
        break;

      // V2: Vocabulary hints
      case 'vocab_hints':
        if (data.hints && data.hints.length > 0) {
          setVocabHints(data.hints);
          // Persist to vocab bank — we need the language from scenarioInfo
          // Use a functional approach to avoid stale closure on scenarioInfo
          setScenarioInfo((si) => {
            if (si?.target_language) {
              addVocabHints(si.target_language, data.hints);
            }
            return si;
          });
        }
        break;

      // V2: Adaptive difficulty change notification
      case 'difficulty_change':
        setDifficultyMode(data.new_mode);
        setDifficultyMessage(data.message);
        // Auto-clear the notification after 4 seconds
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
        break;

      case 'error':
        setError(data.message);
        setIsProcessing(false);
        break;

      default:
        console.warn('Unknown WS message type:', type);
    }
  }, [queueAudio]);

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
      // NOTE: do NOT add to messages here — the backend echoes it back
      // as a `transcription` event, which is the single source of truth.
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

  /** V2: Set correction mode (off|gentle|strict) */
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
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Keep messagesRef current so the evaluation handler can read the full transcript
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-connect when sessionId is set
  useEffect(() => {
    if (sessionId) connect();
    return () => disconnect();
  }, [sessionId, connect, disconnect]);

  return {
    messages,
    isConnected,
    isNpcSpeaking,
    isProcessing,
    evaluation,
    coach,
    learnerProfile,
    scenarioInfo,
    error,
    // V2
    vocabHints,
    difficultyMode,
    difficultyMessage,
    correctionMode,
    setCorrectionMode,
    // Actions
    sendAudioChunk,
    sendAudioEnd,
    sendTextInput,
    requestHint,
    endSession: endSessionWs,
    disconnect,
  };
}
