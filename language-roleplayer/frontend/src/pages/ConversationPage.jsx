import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Burger,
  Button,
  Drawer,
  Group,
  Paper,
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

const LANG_FLAGS = {
  en: '🇬🇧', fr: '🇫🇷', es: '🇪🇸', de: '🇩🇪', ja: '🇯🇵',
  zh: '🇨🇳', it: '🇮🇹', pt: '🇧🇷', ko: '🇰🇷',
};

const DIFF_LABELS = {
  support: { label: 'Support', color: '#1ABC9C' },
  natural: { label: 'Natural', color: '#2E86C1' },
  challenge: { label: 'Challenge', color: '#F0A500' },
};

const CORRECTION_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'gentle', label: 'Gentle' },
  { value: 'strict', label: 'Strict' },
];

function CorrectionHint({ mode }) {
  if (mode === 'off') return <Text fz="xs" c="dimmed">NPC ignores errors — full immersion.</Text>;
  if (mode === 'gentle') return <Text fz="xs" c="dimmed">NPC echoes correct forms naturally.</Text>;
  return <Text fz="xs" c="dimmed">NPC flags errors before responding.</Text>;
}

function VocabHintTypeBadge({ type }) {
  const color = type === 'verb' ? 'teal' : type === 'phrase' ? 'gold' : type === 'adjective' ? 'violet' : 'blue';
  return (
    <Badge size="xs" variant="light" color={color} tt="uppercase" style={{ flexShrink: 0 }}>
      {type}
    </Badge>
  );
}

function ConversationSidebar({
  correctionMode,
  setCorrectionMode,
  isConnected,
  turnCount,
  maxTurns,
  vocabHints,
  npcName,
  requestHint,
  endSession,
  isProcessing,
}) {
  return (
    <Stack gap="lg" p={{ base: 'md', md: 0 }}>
      <div>
        <Text tt="uppercase" fz={10} fw={700} c="dimmed" mb="xs" style={{ letterSpacing: '0.07em' }}>
          Correction mode
        </Text>
        <SegmentedControl
          fullWidth
          size="xs"
          data={CORRECTION_OPTIONS}
          value={correctionMode}
          onChange={setCorrectionMode}
          disabled={!isConnected}
          color="brand"
        />
        <Box mt="xs">
          <CorrectionHint mode={correctionMode} />
        </Box>
      </div>

      <div>
        <Text tt="uppercase" fz={10} fw={700} c="dimmed" mb="xs" style={{ letterSpacing: '0.07em' }}>
          Progress
        </Text>
        <Progress value={Math.min((turnCount / maxTurns) * 100, 100)} color="teal" size="sm" radius="xl" />
        <Text fz="xs" c="dimmed" mt={6}>
          {turnCount} of {maxTurns} turns used
        </Text>
      </div>

      {vocabHints.length > 0 && (
        <div>
          <Text tt="uppercase" fz={10} fw={700} c="dimmed" mb="xs" style={{ letterSpacing: '0.07em' }}>
            Vocab hints
          </Text>
          <Stack gap={6}>
            {vocabHints.map((h, i) => (
              <Group key={i} gap={6} wrap="nowrap" align="center">
                <Text fz="sm" fw={600} ff="'DM Sans', sans-serif" style={{ flexShrink: 0 }}>
                  {h.word}
                </Text>
                <Text fz="xs" c="dimmed">→</Text>
                <Text fz="sm" c="dimmed" style={{ flex: 1 }} lineClamp={1}>
                  {h.translation}
                </Text>
                <VocabHintTypeBadge type={h.type} />
              </Group>
            ))}
          </Stack>
        </div>
      )}

      <Stack gap="xs">
        <Text tt="uppercase" fz={10} fw={700} c="dimmed" style={{ letterSpacing: '0.07em' }}>
          Actions
        </Text>
        <Button variant="light" onClick={requestHint} disabled={!isConnected || isProcessing}>
          Get hint
        </Button>
        <Button color="red" variant="light" onClick={endSession} disabled={!isConnected || isProcessing}>
          End session
        </Button>
      </Stack>

      <Group gap="xs" mt="auto">
        <Box
          w={8}
          h={8}
          style={{
            borderRadius: '50%',
            background: isConnected ? 'var(--mantine-color-teal-5)' : '#aaa',
            boxShadow: isConnected ? '0 0 4px var(--mantine-color-teal-5)' : undefined,
          }}
        />
        <Text fz="xs" c="dimmed">{isConnected ? 'Connected' : 'Connecting…'}</Text>
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
  const flag = LANG_FLAGS[lang] || '🌐';
  const npcName = scenarioInfo?.npc_role || 'NPC';
  const diff = DIFF_LABELS[difficultyMode] || DIFF_LABELS.natural;
  const turnCount = messages.filter((m) => m.role === 'user').length;
  const maxTurns = scenarioInfo?.max_turns || 20;

  const sidebarProps = {
    correctionMode,
    setCorrectionMode,
    isConnected,
    turnCount,
    maxTurns,
    vocabHints,
    npcName,
    requestHint,
    endSession,
    isProcessing,
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
      component="div"
      mih="100vh"
      display="flex"
      style={{ flexDirection: 'column' }}
      bg="gray.1"
    >
      <Group
        justify="space-between"
        wrap="nowrap"
        px="md"
        py="sm"
        bg="brand.9"
        c="white"
        style={{
          minHeight: 60,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          flexShrink: 0,
        }}
      >
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          {isMobile && (
            <Burger opened={drawerOpened} onClick={drawerOpened ? closeDrawer : openDrawer} size="sm" color="white" aria-label="Open menu" />
          )}
          <Button variant="subtle" color="gray" c="white" size="compact-sm" onClick={() => navigate('/')}>
            ← Exit
          </Button>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" wrap="nowrap" align="center">
              <Text span fz="lg" style={{ flexShrink: 0 }}>{flag}</Text>
              <Text fw={700} fz="sm" lineClamp={1} style={{ flex: 1 }}>
                {scenarioInfo?.title || 'Connecting…'}
              </Text>
            </Group>
            <Text fz="xs" c="rgba(255,255,255,0.6)" lineClamp={1}>
              {npcName}
            </Text>
          </Box>
        </Group>

        <Group gap="md" wrap="nowrap" visibleFrom="sm" style={{ flexShrink: 0 }}>
          <Text
            fz="xs"
            fw={700}
            px="sm"
            py={4}
            style={{ borderRadius: 20, border: `1.5px solid ${diff.color}`, color: diff.color }}
          >
            {diff.label}
          </Text>
          <Text fz="xs" c="rgba(255,255,255,0.65)">
            {turnCount}/{maxTurns} turns
          </Text>
        </Group>
      </Group>

      {difficultyMessage && (
        <Paper
          mx="auto"
          mt="sm"
          px="lg"
          py="xs"
          radius="xl"
          bg="brand.9"
          c="white"
          shadow="md"
          maw="90%"
        >
          <Text fz="sm" fw={600} ta="center">
            🎯 {difficultyMessage}
          </Text>
        </Paper>
      )}

      <Drawer
        opened={drawerOpened && !!isMobile}
        onClose={closeDrawer}
        title="Session"
        position="left"
        size="85%"
        padding="md"
        zIndex={400}
      >
        <ConversationSidebar {...sidebarProps} />
      </Drawer>

      <Group align="stretch" gap={0} wrap="nowrap" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {!isMobile && (
          <Paper
            w={280}
            miw={260}
            radius={0}
            withBorder
            p="md"
            style={{ borderTop: 0, borderBottom: 0, borderLeft: 0, flexShrink: 0, overflowY: 'auto' }}
          >
            <ConversationSidebar {...sidebarProps} />
          </Paper>
        )}

        <Stack gap={0} style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          <ScrollArea
            viewportRef={transcriptViewport}
            type="auto"
            style={{ flex: 1, minHeight: 0 }}
            p="lg"
            offsetScrollbars
          >
            <Stack gap="md" align="stretch">
              {messages.length === 0 && (
                <Stack align="center" py={48} gap="sm">
                  <Text fz="3rem">{flag}</Text>
                  <Text c="dimmed" fz="sm">Your conversation will appear here.</Text>
                </Stack>
              )}

              {messages.map((msg, i) => (
                <Stack
                  key={i}
                  gap={4}
                  align={msg.role === 'user' ? 'flex-end' : msg.role === 'system' ? 'center' : 'flex-start'}
                  maw={msg.role === 'system' ? '90%' : '72%'}
                  alignSelf={msg.role === 'user' ? 'flex-end' : msg.role === 'system' ? 'center' : 'flex-start'}
                  style={{ opacity: msg.streaming ? 0.85 : 1 }}
                >
                  {msg.role !== 'system' && (
                    <Text tt="uppercase" fz={10} fw={600} c="dimmed" ta={msg.role === 'user' ? 'right' : 'left'}>
                      {msg.role === 'npc' ? npcName : 'You'}
                    </Text>
                  )}
                  <Paper
                    px="md"
                    py="sm"
                    radius="md"
                    shadow="xs"
                    withBorder={msg.role === 'npc'}
                    bg={msg.role === 'user' ? 'brand.5' : msg.role === 'system' ? 'gray.1' : 'white'}
                    c={msg.role === 'user' ? 'white' : msg.role === 'system' ? 'dimmed' : undefined}
                    style={{
                      borderBottomRightRadius: msg.role === 'user' ? 4 : undefined,
                      borderBottomLeftRadius: msg.role === 'npc' ? 4 : undefined,
                      fontStyle: msg.role === 'system' ? 'italic' : undefined,
                      fontSize: msg.role === 'system' ? '0.82rem' : '0.9rem',
                    }}
                  >
                    <Text fz="inherit" style={{ lineHeight: 1.5 }} ff={msg.role === 'npc' || msg.role === 'user' ? "'DM Sans', sans-serif" : undefined}>
                      {msg.text}
                    </Text>
                  </Paper>
                </Stack>
              ))}

              {isProcessing && (
                <Group gap={6} align="center" px="md" py="sm" alignSelf="flex-start">
                  {[0, 1, 2].map((d) => (
                    <Box
                      key={d}
                      className={`thinking-dot thinking-dot-${d}`}
                      w={7}
                      h={7}
                      bg="brand.5"
                      style={{ borderRadius: '50%' }}
                    />
                  ))}
                </Group>
              )}
            </Stack>
          </ScrollArea>

          {isNpcSpeaking && (
            <Group px="lg" py="xs" bg="gray.2" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }} gap="xs">
              <Text fz="sm" c="brand.7">🔊 {npcName} is speaking…</Text>
            </Group>
          )}

          {(error || micError) && (
            <Alert color="red" mx="md" mb={0} title="Error">
              {error || micError}
            </Alert>
          )}

          <Group
            p="md"
            align="center"
            wrap="nowrap"
            gap="md"
            bg="white"
            style={{ borderTop: '1px solid var(--mantine-color-gray-3)', flexShrink: 0 }}
          >
            <UnstyledButton
              onClick={handleMicToggle}
              disabled={!isConnected || isNpcSpeaking}
              w={72}
              h={72}
              style={{
                borderRadius: '50%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: (!isConnected || isNpcSpeaking) ? 'not-allowed' : 'pointer',
                opacity: (!isConnected || isNpcSpeaking) ? 0.5 : 1,
                background: isRecording
                  ? 'var(--mantine-color-red-6)'
                  : 'var(--mantine-color-brand-filled)',
                color: 'white',
                boxShadow: isRecording
                  ? '0 0 0 0 rgba(231,76,60,0.5)'
                  : '0 4px 14px rgba(46,134,193,0.4)',
                animation: isRecording ? 'micPulse 1.2s ease-in-out infinite' : undefined,
              }}
            >
              <Text fz="xl" c="inherit">🎙️</Text>
              <Text fz={10} fw={600} c="inherit">{isRecording ? 'Listening…' : 'Speak'}</Text>
            </UnstyledButton>

            <ActionIcon
              variant="default"
              size="lg"
              radius="xl"
              onClick={() => setShowTextInput((v) => !v)}
              title="Toggle text input"
            >
              ⌨️
            </ActionIcon>

            {showTextInput && (
              <form onSubmit={handleTextSubmit} style={{ flex: 1, display: 'flex', gap: 8 }}>
                <TextInput
                  style={{ flex: 1 }}
                  placeholder={`Type in ${lang.toUpperCase()}…`}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  disabled={!isConnected || isProcessing}
                  autoFocus
                />
                <Button type="submit" disabled={!isConnected || isProcessing || !textInput.trim()}>
                  Send
                </Button>
              </form>
            )}
          </Group>
        </Stack>
      </Group>

      <style>
        {`
          @keyframes micPulse {
            0% { box-shadow: 0 0 0 0 rgba(231,76,60,0.5); }
            70% { box-shadow: 0 0 0 14px rgba(231,76,60,0); }
            100% { box-shadow: 0 0 0 0 rgba(231,76,60,0); }
          }
          @keyframes thinkingBounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
            40% { transform: translateY(-6px); opacity: 1; }
          }
          .thinking-dot { animation: thinkingBounce 1.2s ease-in-out infinite; }
          .thinking-dot-0 { animation-delay: 0s; }
          .thinking-dot-1 { animation-delay: 0.2s; }
          .thinking-dot-2 { animation-delay: 0.4s; }
        `}
      </style>
    </Box>
  );
}
