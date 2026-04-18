import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Box,
  Burger,
  Button,
  Drawer,
  Group,
  Progress,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import useConversation from '../hooks/useConversation';
import useAudioRecorder from '../hooks/useAudioRecorder';
import EvaluationReport from '../components/EvaluationReport';
import { scenarioScene, scenarioMoodName } from '../utils/scenarioBanner';

const LANG_CITIES = {
  en: 'London', fr: 'Paris', es: 'Seville', de: 'Berlin',
  ja: 'Kyoto', zh: 'Shanghai', it: 'Rome', pt: 'Lisbon', ko: 'Seoul',
};

const LANG_CODES = {
  en: 'EN', fr: 'FR', es: 'ES', de: 'DE', ja: 'JA',
  zh: 'ZH', it: 'IT', pt: 'PT', ko: 'KO',
};

const TEMPO_META = {
  support:   { label: 'Gentle',    hint: 'supportive pace' },
  natural:   { label: 'Measured',  hint: 'natural pace' },
  challenge: { label: 'Immersive', hint: 'challenging pace' },
};

const CORRECTION_OPTIONS = [
  { value: 'off',    label: 'Off' },
  { value: 'gentle', label: 'Gentle' },
  { value: 'strict', label: 'Strict' },
];

function formatRoleWithArticle(role) {
  if (!role) return role;
  const trimmed = role.trim();
  if (!trimmed) return trimmed;

  const articleMatch = trimmed.match(/^(A|An|The)(\s+)(.+)/);
  if (articleMatch) {
    return articleMatch[1].toLowerCase() + articleMatch[2] + articleMatch[3];
  }

  const words = trimmed.split(/\s+/);
  const looksLikeProperName =
    words.length === 1 && /^[A-Z][a-z'’\-]+$/.test(words[0]);
  if (looksLikeProperName) return trimmed;

  const firstChar = trimmed.charAt(0).toLowerCase();
  const article = 'aeiou'.includes(firstChar) ? 'an' : 'a';
  return `${article} ${trimmed}`;
}

function extractNpcDisplayName(role) {
  if (!role) return role;
  const trimmed = role.trim();
  if (!trimmed) return trimmed;

  const namedMatch = trimmed.match(/\b(?:named|called)\s+(.+)$/i);
  if (namedMatch) {
    return namedMatch[1].trim();
  }

  return trimmed;
}

function Eyebrow({ children, c = 'ink.6', ...rest }) {
  return (
    <Text
      fz={10}
      fw={700}
      c={c}
      style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
      {...rest}
    >
      {children}
    </Text>
  );
}

function CorrectionHint({ mode }) {
  const copy =
    mode === 'off'
      ? 'Your companion ignores errors. Full immersion.'
      : mode === 'gentle'
        ? 'Your companion echoes the correct form, gently.'
        : 'Your companion pauses to flag errors before continuing.';
  return (
    <Text fz="xs" c="ink.6" style={{ lineHeight: 1.55 }}>
      {copy}
    </Text>
  );
}

function VocabHintTypeMark({ type }) {
  return (
    <Text
      fz={9}
      fw={700}
      px={6}
      py={2}
      style={{
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        border: '1px solid var(--sny-hairline)',
        color: 'var(--sny-ink-soft)',
        background: 'var(--sny-paper)',
        flexShrink: 0,
      }}
    >
      {type}
    </Text>
  );
}

function ScenePanel({
  correctionMode,
  setCorrectionMode,
  isConnected,
  turnCount,
  maxTurns,
  vocabHints,
  tempo,
  requestHint,
  endSession,
  isProcessing,
  city,
  moodName,
  npcLabel,
  title,
}) {
  const pct = Math.min((turnCount / maxTurns) * 100, 100);
  return (
    <Stack gap={28} p={{ base: 'md', md: 'lg' }}>
      {/* Scene header inside the panel */}
      <Stack gap={6}>
        <Eyebrow c="clay.6">{city ? `The scene · ${city}` : 'The scene'}</Eyebrow>
        <Text
          className="sny-serif"
          fz={26}
          fw={500}
          c="ink.8"
          style={{ lineHeight: 1.1, letterSpacing: '-0.01em' }}
        >
          {title || 'A quiet encounter.'}
        </Text>
        {npcLabel && (
          <Text fz="sm" fs="italic" c="ink.6" className="sny-serif" fw={500}>
            with {npcLabel}
          </Text>
        )}
        {moodName && (
          <Text fz={10} c="ink.5" style={{ letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            {moodName}
          </Text>
        )}
      </Stack>

      {/* Progress ledger */}
      <Box>
        <Group justify="space-between" mb={8}>
          <Eyebrow>Act of conversation</Eyebrow>
          <Text fz="xs" c="ink.6" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {turnCount} / {maxTurns}
          </Text>
        </Group>
        <Progress
          value={pct}
          color="clay.5"
          size={4}
          radius={0}
          styles={{
            root: { background: 'var(--sny-paper-deep)' },
          }}
        />
        {tempo && (
          <Text fz={10} c="ink.5" mt={6} style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Tempo · {TEMPO_META[tempo]?.label || tempo}
          </Text>
        )}
      </Box>

      {/* Correction mode */}
      <Box>
        <Eyebrow mb={8}>Companion guidance</Eyebrow>
        <SegmentedControl
          fullWidth
          size="xs"
          data={CORRECTION_OPTIONS}
          value={correctionMode}
          onChange={setCorrectionMode}
          disabled={!isConnected}
          radius={0}
          styles={{
            root: {
              background: 'var(--sny-paper)',
              border: '1px solid var(--sny-hairline)',
              padding: 2,
            },
            indicator: {
              background: 'var(--sny-ink)',
              boxShadow: 'none',
              borderRadius: 0,
            },
            label: {
              color: 'var(--sny-ink-soft)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.04em',
            },
            labelActive: {
              color: 'var(--sny-paper-highlight) !important',
            },
          }}
        />
        <Box mt={8}>
          <CorrectionHint mode={correctionMode} />
        </Box>
      </Box>

      {/* Vocab — study notes */}
      {vocabHints.length > 0 && (
        <Box>
          <Eyebrow mb={8}>Useful phrases</Eyebrow>
          <Stack
            gap={2}
            style={{
              borderTop: '1px solid var(--sny-hairline)',
            }}
          >
            {vocabHints.map((h, i) => (
              <Group
                key={i}
                gap={10}
                wrap="nowrap"
                align="baseline"
                py={10}
                style={{ borderBottom: '1px solid var(--sny-hairline-soft)' }}
              >
                <Text
                  fz="sm"
                  fw={600}
                  className="sny-serif"
                  c="clay.7"
                  style={{ flexShrink: 0 }}
                >
                  {h.word}
                </Text>
                <Text fz="xs" c="ink.5" style={{ flexShrink: 0 }}>—</Text>
                <Text fz="sm" c="ink.7" style={{ flex: 1, lineHeight: 1.4 }} lineClamp={1}>
                  {h.translation}
                </Text>
                <VocabHintTypeMark type={h.type} />
              </Group>
            ))}
          </Stack>
        </Box>
      )}

      {/* Actions */}
      <Stack gap={8}>
        <Eyebrow>Actions</Eyebrow>
        <Button
          variant="default"
          radius={0}
          onClick={requestHint}
          disabled={!isConnected || isProcessing}
          styles={{
            root: {
              background: 'var(--sny-paper)',
              border: '1px solid var(--sny-hairline)',
              color: 'var(--sny-ink)',
              fontWeight: 600,
              letterSpacing: '0.02em',
            },
          }}
        >
          Request a prompt
        </Button>
        <Button
          variant="filled"
          color="clay.6"
          radius={0}
          onClick={endSession}
          disabled={!isConnected || isProcessing}
          styles={{
            root: {
              fontWeight: 600,
              letterSpacing: '0.02em',
            },
          }}
        >
          Close the scene
        </Button>
      </Stack>

      <Group gap="xs" mt="auto" align="center">
        <Box
          w={6}
          h={6}
          style={{
            borderRadius: '50%',
            background: isConnected ? 'var(--sny-olive)' : 'var(--sny-ink-mute)',
            boxShadow: isConnected ? '0 0 0 3px rgba(110, 127, 70, 0.15)' : 'none',
          }}
        />
        <Text fz="xs" c="ink.6">
          {isConnected ? 'Line open' : 'Opening the line…'}
        </Text>
      </Group>
    </Stack>
  );
}

export default function ConversationPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const transcriptViewport = useRef(null);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const isMobile = useMediaQuery('(max-width: 48em)');

  const {
    messages,
    isConnected,
    isNpcSpeaking,
    isProcessing,
    evaluation,
    scenarioInfo,
    error,
    vocabHints,
    difficultyMode,
    difficultyMessage,
    correctionMode,
    setCorrectionMode,
    sendAudioChunk,
    sendAudioEnd,
    sendTextInput,
    requestHint,
    endSession,
  } = useConversation(sessionId);

  const { isRecording, startRecording, stopRecording, error: micError } =
    useAudioRecorder({
      onAudioChunk: sendAudioChunk,
      onRecordingStop: sendAudioEnd,
    });

  useEffect(() => {
    const el = transcriptViewport.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  function handleTextSubmit(e) {
    e.preventDefault();
    if (!textInput.trim()) return;
    sendTextInput(textInput.trim());
    setTextInput('');
  }

  function handleMicToggle() {
    if (isRecording) stopRecording();
    else startRecording();
  }

  const lang = scenarioInfo?.target_language || 'fr';
  const langCode = LANG_CODES[lang] || '··';
  const city = LANG_CITIES[lang] || 'Atelier';
  const moodName = scenarioMoodName(lang);
  const sceneBg = scenarioScene(lang);
  const npcRole = scenarioInfo?.npc_role || 'your companion';
  const npcLabel = formatRoleWithArticle(npcRole);
  const npcDisplayName = extractNpcDisplayName(npcRole) || npcLabel;
  const turnCount = messages.filter((m) => m.role === 'user').length;
  const maxTurns = scenarioInfo?.max_turns || 20;

  const panelProps = {
    correctionMode,
    setCorrectionMode,
    isConnected,
    turnCount,
    maxTurns,
    vocabHints,
    tempo: difficultyMode,
    npcLabel,
    requestHint,
    endSession,
    isProcessing,
    city,
    moodName,
    title: scenarioInfo?.title,
  };

  if (evaluation) {
    return (
      <EvaluationReport
        report={evaluation}
        scenarioInfo={scenarioInfo}
        onNewSession={() => navigate('/')}
      />
    );
  }

  return (
    <Box
      mih="100vh"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sny-paper)',
      }}
    >
      {/* ── Immersive scene header ─────────────────────────────────────── */}
      <Box
        style={{
          position: 'relative',
          borderBottom: '1px solid var(--sny-hairline)',
          backgroundColor: 'var(--sny-paper-deep)',
          backgroundImage: sceneBg,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Film grain overlay */}
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='8'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.12 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
            mixBlendMode: 'overlay',
            opacity: 0.65,
            pointerEvents: 'none',
          }}
        />

        <Group
          justify="space-between"
          wrap="nowrap"
          px={{ base: 'md', md: 'lg' }}
          py="md"
          align="center"
          style={{ position: 'relative' }}
        >
          <Group gap="sm" wrap="nowrap" align="center" style={{ minWidth: 0 }}>
            {isMobile && (
              <Burger
                opened={drawerOpened}
                onClick={drawerOpened ? closeDrawer : openDrawer}
                size="sm"
                color="var(--sny-ink)"
                aria-label="Open menu"
              />
            )}
            <UnstyledButton
              onClick={() => navigate('/')}
              style={{
                color: 'var(--sny-ink-soft)',
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 600,
                padding: '4px 8px',
                border: '1px solid var(--sny-hairline)',
                background: 'rgba(251, 247, 240, 0.75)',
              }}
            >
              ← Exit scene
            </UnstyledButton>
          </Group>

          <Box
            visibleFrom="sm"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              maxWidth: '60%',
            }}
          >
            <Text
              fz={10}
              fw={700}
              c="ink.7"
              style={{ letterSpacing: '0.3em', textTransform: 'uppercase' }}
            >
              · {city} · {langCode} ·
            </Text>
            <Text
              className="sny-serif"
              fz={{ base: 18, md: 22 }}
              c="ink.8"
              lineClamp={1}
              mt={2}
              style={{ letterSpacing: '-0.01em', lineHeight: 1.2 }}
            >
              {scenarioInfo?.title || 'Connecting to the scene…'}
            </Text>
            <Text fz={11} c="ink.6" fs="italic" className="sny-serif" lineClamp={1} mt={2}>
              with {npcLabel}
            </Text>
          </Box>

          <Group gap="sm" wrap="nowrap">
            <Text
              fz={10}
              fw={600}
              c="ink.6"
              style={{
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {turnCount}/{maxTurns}
            </Text>
          </Group>
        </Group>

        {/* Mobile stacked title */}
        <Box hiddenFrom="sm" px="md" pb="sm" style={{ position: 'relative' }}>
          <Text
            fz={10}
            fw={700}
            c="ink.7"
            style={{ letterSpacing: '0.28em', textTransform: 'uppercase' }}
          >
            {city} · {langCode}
          </Text>
          <Text
            className="sny-serif"
            fz={18}
            c="ink.8"
            lineClamp={1}
            style={{ lineHeight: 1.15 }}
          >
            {scenarioInfo?.title || 'Connecting…'}
          </Text>
          <Text fz={11} c="ink.6" fs="italic" className="sny-serif" lineClamp={1}>
            with {npcLabel}
          </Text>
        </Box>
      </Box>

      {/* Adaptive tempo message — a gentle marginal note */}
      {difficultyMessage && (
        <Box
          mx="auto"
          mt={12}
          px="lg"
          py={8}
          maw="92%"
          className="sny-anim-fade-in"
          style={{
            background: 'var(--sny-ink)',
            color: 'var(--sny-paper-highlight)',
            border: '1px solid var(--sny-ink)',
            boxShadow: 'var(--mantine-shadow-md)',
          }}
        >
          <Text fz="sm" fw={500} ta="center" className="sny-serif" fs="italic">
            {difficultyMessage}
          </Text>
        </Box>
      )}

      {/* Mobile drawer */}
      <Drawer
        opened={drawerOpened && !!isMobile}
        onClose={closeDrawer}
        title={
          <Text
            fz={10}
            fw={700}
            c="clay.6"
            style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
          >
            Scene notes
          </Text>
        }
        position="left"
        size="88%"
        padding={0}
        zIndex={400}
        styles={{
          content: { background: 'var(--sny-paper-highlight)' },
          header: { background: 'var(--sny-paper-highlight)', borderBottom: '1px solid var(--sny-hairline)' },
          body: { padding: 0 },
        }}
      >
        <ScenePanel {...panelProps} />
      </Drawer>

      {/* ── Main layout: side panel + conversation ───────────────────── */}
      <Group
        align="stretch"
        gap={0}
        wrap="nowrap"
        style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
        {!isMobile && (
          <Box
            w={320}
            miw={280}
            style={{
              flexShrink: 0,
              borderRight: '1px solid var(--sny-hairline)',
              background: 'var(--sny-paper-highlight)',
              overflowY: 'auto',
            }}
          >
            <ScenePanel {...panelProps} />
          </Box>
        )}

        <Stack gap={0} style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          <ScrollArea
            viewportRef={transcriptViewport}
            type="auto"
            style={{ flex: 1, minHeight: 0 }}
            offsetScrollbars
          >
            <Box
              mx="auto"
              maw={760}
              px={{ base: 'md', md: 'xl' }}
              py={{ base: 'lg', md: 40 }}
            >
              {messages.length === 0 && !isProcessing && (
                <Stack align="center" py={60} gap="xs">
                  <Text
                    fz={10}
                    fw={700}
                    c="clay.6"
                    style={{ letterSpacing: '0.28em', textTransform: 'uppercase' }}
                  >
                    Stage set
                  </Text>
                  <Text
                    className="sny-serif"
                    fz={28}
                    fs="italic"
                    c="ink.7"
                    ta="center"
                  >
                    A hush before the dialogue begins.
                  </Text>
                  <Text fz="sm" c="ink.6" ta="center" maw={360} mt="xs" style={{ lineHeight: 1.6 }}>
                    When you are ready, press the microphone and speak. Your
                    companion is listening.
                  </Text>
                </Stack>
              )}

              <Stack gap={22}>
                {messages.map((msg, i) => (
                  <MessageLine
                    key={i}
                    msg={msg}
                    npcName={npcDisplayName}
                  />
                ))}

                {isProcessing && (
                  <Group gap={8} align="center" py="xs" className="sny-anim-fade-in">
                    <Box className="sny-dot sny-dot--0" />
                    <Box className="sny-dot sny-dot--1" />
                    <Box className="sny-dot sny-dot--2" />
                    <Text fz={11} c="ink.6" ml={4} style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                      Composing a reply
                    </Text>
                  </Group>
                )}
              </Stack>
            </Box>
          </ScrollArea>

          {isNpcSpeaking && (
            <Box
              px="lg"
              py={10}
              style={{
                background: 'var(--sny-paper-highlight)',
                borderTop: '1px solid var(--sny-hairline)',
              }}
            >
              <Group gap="xs" align="center">
                <Box
                  w={6}
                  h={6}
                  style={{
                    borderRadius: '50%',
                    background: 'var(--sny-clay)',
                    animation: 'sny-listening 1.6s ease-in-out infinite',
                  }}
                />
                <Text fz={11} c="ink.7" style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {npcDisplayName} is speaking
                </Text>
              </Group>
            </Box>
          )}

          {(error || micError) && (
            <Alert
              color="clay"
              mx="md"
              my={8}
              radius={0}
              styles={{
                root: {
                  background: 'rgba(193, 87, 63, 0.08)',
                  border: '1px solid rgba(193, 87, 63, 0.35)',
                },
                title: { color: 'var(--sny-clay-deep)' },
              }}
              title="A small interruption"
            >
              {error || micError}
            </Alert>
          )}

          {/* Voice + text input — mic is the center of gravity. */}
          <Box
            style={{
              borderTop: '1px solid var(--sny-hairline)',
              background: 'var(--sny-paper-highlight)',
              flexShrink: 0,
            }}
          >
            <Box px={{ base: 'md', md: 'xl' }} py="lg">
              <Stack gap="md" maw={760} mx="auto">
                <Group align="center" justify="center" gap="lg" wrap="nowrap">
                  <UnstyledButton
                    onClick={handleMicToggle}
                    disabled={!isConnected || isNpcSpeaking}
                    className={isRecording ? 'sny-mic--listening' : 'sny-mic'}
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: '50%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      cursor: (!isConnected || isNpcSpeaking) ? 'not-allowed' : 'pointer',
                      opacity: (!isConnected || isNpcSpeaking) ? 0.5 : 1,
                      background: isRecording
                        ? 'linear-gradient(180deg, #D27A57 0%, #A9442E 100%)'
                        : 'linear-gradient(180deg, #1F2748 0%, #0F142A 100%)',
                      color: 'var(--sny-paper-highlight)',
                      border: isRecording
                        ? '1px solid rgba(193, 87, 63, 0.6)'
                        : '1px solid rgba(15, 20, 42, 0.5)',
                      transition: 'background 0.2s ease, border-color 0.2s ease',
                    }}
                    aria-label={isRecording ? 'Stop listening' : 'Start speaking'}
                  >
                    {/* Minimal mic glyph drawn with SVG — no emoji. */}
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="9" y="3" width="6" height="11" rx="3" />
                      <path d="M5 11a7 7 0 0 0 14 0" />
                      <line x1="12" y1="18" x2="12" y2="22" />
                    </svg>
                    <Text
                      fz={9}
                      fw={700}
                      c="inherit"
                      style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
                    >
                      {isRecording ? 'Listening' : 'Speak'}
                    </Text>
                  </UnstyledButton>

                  <Stack gap={2} style={{ flex: 1 }}>
                    <Text
                      fz={10}
                      fw={700}
                      c="ink.6"
                      style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
                    >
                      {isRecording
                        ? 'Your voice is the scene'
                        : isNpcSpeaking
                          ? 'Please listen'
                          : 'Your turn'}
                    </Text>
                    <Text className="sny-serif" fz={16} c="ink.7" fs="italic" lineClamp={1}>
                      {isRecording
                        ? 'Speak naturally — pauses are welcome.'
                        : isNpcSpeaking
                          ? `${npcDisplayName} is speaking…`
                          : 'Tap the microphone, or type below.'}
                    </Text>
                  </Stack>

                  <ActionIcon
                    variant="default"
                    size={42}
                    radius={0}
                    onClick={() => setShowTextInput((v) => !v)}
                    title="Toggle text input"
                    styles={{
                      root: {
                        border: '1px solid var(--sny-hairline)',
                        background: showTextInput
                          ? 'var(--sny-ink)'
                          : 'var(--sny-paper)',
                        color: showTextInput ? 'var(--sny-paper-highlight)' : 'var(--sny-ink)',
                      },
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="4 7 4 4 20 4 20 7" />
                      <line x1="9" y1="20" x2="15" y2="20" />
                      <line x1="12" y1="4" x2="12" y2="20" />
                    </svg>
                  </ActionIcon>
                </Group>

                {showTextInput && (
                  <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: 8 }}>
                    <TextInput
                      style={{ flex: 1 }}
                      placeholder={`Write in ${langCode}…`}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      disabled={!isConnected || isProcessing}
                      autoFocus
                      radius={0}
                      styles={{
                        input: {
                          background: 'var(--sny-paper)',
                          border: '1px solid var(--sny-hairline)',
                          fontFamily: 'var(--sny-serif)',
                          fontStyle: 'italic',
                          fontSize: 15,
                          color: 'var(--sny-ink)',
                        },
                      }}
                    />
                    <Button
                      type="submit"
                      color="ink.8"
                      radius={0}
                      disabled={!isConnected || isProcessing || !textInput.trim()}
                    >
                      Send
                    </Button>
                  </form>
                )}
              </Stack>
            </Box>
          </Box>
        </Stack>
      </Group>
    </Box>
  );
}

/**
 * A single line of the transcript.
 * Styled like a dialogue in a printed play: role in smallcaps,
 * line below in serif italic for the NPC and clean sans for you.
 */
function MessageLine({ msg, npcName }) {
  if (msg.role === 'system') {
    return (
      <Box className="sny-anim-fade-in" style={{ textAlign: 'center' }}>
        <Text
          fz={10}
          fw={700}
          c="ink.5"
          style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
        >
          · stage direction ·
        </Text>
        <Text
          className="sny-serif"
          fz={14}
          fs="italic"
          c="ink.6"
          mt={4}
        >
          {msg.text}
        </Text>
      </Box>
    );
  }

  const isUser = msg.role === 'user';
  return (
    <Box
      className="sny-anim-fade-in"
      style={{
        display: 'grid',
        gridTemplateColumns: '90px 1fr',
        columnGap: 16,
        alignItems: 'baseline',
        opacity: msg.streaming ? 0.88 : 1,
      }}
    >
      <Text
        fz={10}
        fw={700}
        c={isUser ? 'clay.6' : 'ink.7'}
        style={{
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          paddingTop: 3,
        }}
        ta="right"
      >
        {isUser ? 'You' : npcName}
      </Text>
      <Text
        fz={{ base: 16, md: 17 }}
        className={isUser ? undefined : 'sny-serif'}
        fs={isUser ? 'normal' : 'italic'}
        fw={isUser ? 500 : 500}
        c={isUser ? 'ink.8' : 'ink.7'}
        style={{
          lineHeight: 1.55,
          letterSpacing: isUser ? '0' : '-0.005em',
        }}
      >
        {msg.text}
      </Text>
    </Box>
  );
}
