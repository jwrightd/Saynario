import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Box,
  Center,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Tabs,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { EvaluationContent } from '../components/EvaluationReport';
import { createSession } from '../utils/api';
import { getSessionHistory, deleteSessionRecord, saveCoachScenario } from '../utils/storage';

const LANG_FLAGS = {
  fr: '🇫🇷', es: '🇪🇸', de: '🇩🇪', ja: '🇯🇵',
  zh: '🇨🇳', it: '🇮🇹', pt: '🇵🇹', ko: '🇰🇷', en: '🇬🇧',
};

const DIFF_LABELS = {
  beginner: 'Gentle',
  intermediate: 'Measured',
  advanced: 'Immersive',
};

const NPC_NAME_RE = /\b(?:named|called)\s+(\S+)/i;

function scoreColor(score) {
  if (score >= 80) return 'var(--sny-olive)';
  if (score >= 55) return 'var(--sny-gilt)';
  return 'var(--sny-clay)';
}

const TAB_STYLES = {
  tab: {
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--sny-ink-soft)',
    borderRadius: 0,
    padding: '14px 18px',
  },
};

function TranscriptView({ record }) {
  const npcName =
    record.scenarioInfo?.npc_role?.match(NPC_NAME_RE)?.[1] || 'NPC';
  const lines = (record.transcript || []).filter((m) => m.role !== 'system');

  if (lines.length === 0) {
    return (
      <Center py={80}>
        <Text fz="sm" c="ink.5" fs="italic">No transcript saved for this session.</Text>
      </Center>
    );
  }

  return (
    <Stack gap={20} px={{ base: 'lg', sm: 48 }} py={36}>
      {lines.map((m, i) => {
        const isUser = m.role === 'user';
        return (
          <Box
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr',
              columnGap: 18,
              alignItems: 'baseline',
            }}
          >
            <Text
              fz={10}
              fw={700}
              c={isUser ? 'clay.6' : 'ink.7'}
              ta="right"
              style={{ letterSpacing: '0.18em', textTransform: 'uppercase', paddingTop: 3 }}
            >
              {isUser ? 'You' : npcName}
            </Text>
            <Text
              fz={16}
              className={isUser ? undefined : 'sny-serif'}
              fs={isUser ? 'normal' : 'italic'}
              c={isUser ? 'ink.8' : 'ink.7'}
              style={{ lineHeight: 1.6 }}
            >
              {m.text}
            </Text>
          </Box>
        );
      })}
    </Stack>
  );
}

function SessionRow({ record, isLast, onView, onDelete }) {
  const date = new Date(record.completedAt);
  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const score = Math.round(record.evaluation?.overall_score || 0);
  const cefr = record.evaluation?.cefr_estimate;
  const flag = LANG_FLAGS[record.language] || '·';
  const diffLabel = DIFF_LABELS[record.difficulty] || record.difficulty;

  return (
    <Group
      justify="space-between"
      align="center"
      wrap="nowrap"
      px="md"
      py="sm"
      gap="md"
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--sny-hairline-soft)',
        background: 'var(--sny-paper-highlight)',
        cursor: 'pointer',
        transition: 'background 0.12s ease',
      }}
      onClick={onView}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sny-paper-deep)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--sny-paper-highlight)')}
    >
      <Group gap={12} wrap="nowrap" style={{ minWidth: 0 }}>
        <Text fz={20}>{flag}</Text>
        <Stack gap={1} style={{ minWidth: 0 }}>
          <Text fz="sm" fw={600} c="ink.8" lineClamp={1}>{record.scenarioTitle}</Text>
          <Text fz={10} c="ink.5" style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {diffLabel} · {dateStr}
          </Text>
        </Stack>
      </Group>

      <Group gap={14} wrap="nowrap" style={{ flexShrink: 0 }}>
        {cefr && (
          <Text
            fz={10} fw={700} px={6} py={2}
            style={{
              letterSpacing: '0.16em',
              border: '1px solid var(--sny-clay)',
              color: 'var(--sny-clay-deep)',
              background: 'rgba(193, 87, 63, 0.06)',
            }}
          >
            {cefr}
          </Text>
        )}
        <Text
          className="sny-serif" fz={24} fw={500}
          style={{ color: scoreColor(score), fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}
        >
          {score}
        </Text>
        <ActionIcon
          variant="subtle" size="sm" radius={0}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete this record"
          styles={{ root: { color: 'var(--sny-ink-mute)' } }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </ActionIcon>
      </Group>
    </Group>
  );
}

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [startingRecommended, setStartingRecommended] = useState(false);
  const [startRecommendationError, setStartRecommendationError] = useState('');
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const navigate = useNavigate();

  useEffect(() => {
    setHistory(getSessionHistory());
  }, []);

  function handleView(record) {
    setViewing(record);
    setStartRecommendationError('');
    setStartingRecommended(false);
    openModal();
  }

  function handleDelete(id) {
    deleteSessionRecord(id);
    setHistory(getSessionHistory());
    if (viewing?.id === id) closeModal();
  }

  async function handleStartRecommended() {
    if (!viewing?.coach?.next_scenario || startingRecommended) return;
    try {
      setStartingRecommended(true);
      setStartRecommendationError('');
      const savedScenario = saveCoachScenario(viewing.coach.next_scenario, viewing.scenarioInfo);
      const session = await createSession(null, savedScenario || viewing.coach.next_scenario);
      closeModal();
      navigate(`/conversation/${session.id}`, {
        state: { recommendedCorrectionMode: viewing.coach.recommended_correction_mode },
      });
    } catch (err) {
      setStartRecommendationError(`Could not start the recommended scene: ${err.message}`);
      setStartingRecommended(false);
    }
  }

  return (
    <Stack gap={40} className="sny-anim-fade-soft">
      {/* ── Page heading ─────────────────────────────────────────── */}
      <Box>
        <Text fz={10} fw={700} c="clay.6" mb={12}
          style={{ letterSpacing: '0.3em', textTransform: 'uppercase' }}>
          · Your archive
        </Text>
        <Text className="sny-serif" fz={{ base: 44, sm: 58 }} fw={500} c="ink.8"
          style={{ lineHeight: 1.02, letterSpacing: '-0.02em', maxWidth: 720 }}>
          Past conversations.
          <br />
          <Text span inherit fs="italic" c="clay.6">Every debrief, kept.</Text>
        </Text>
        <Text mt="md" fz="md" c="ink.6" maw={580} style={{ lineHeight: 1.65 }}>
          A ledger of every scene you have completed. Click a row to revisit
          the evaluation report or read back through the full chat log.
        </Text>
      </Box>

      {/* ── Session list ─────────────────────────────────────────── */}
      {history.length === 0 ? (
        <Center py={100}>
          <Stack align="center" gap="sm" maw={380}>
            <Text className="sny-serif" fz={28} c="ink.7" ta="center" fs="italic">
              The archive is empty.
            </Text>
            <Text c="ink.6" ta="center" fz="sm" style={{ lineHeight: 1.6 }}>
              Complete a scene and your report will appear here automatically.
            </Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="md">
          <Stack gap={2}>
            <Text fz={10} fw={700} c="clay.6"
              style={{ letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              The ledger
            </Text>
            <Text className="sny-serif" fz={{ base: 28, sm: 34 }} c="ink.8" fw={500}
              style={{ lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              {history.length} session{history.length !== 1 ? 's' : ''}
            </Text>
          </Stack>

          <Box style={{ border: '1px solid var(--sny-hairline)' }}>
            {history.map((record, i) => (
              <SessionRow
                key={record.id}
                record={record}
                isLast={i === history.length - 1}
                onView={() => handleView(record)}
                onDelete={() => handleDelete(record.id)}
              />
            ))}
          </Box>
        </Stack>
      )}

      {/* ── Session detail modal ─────────────────────────────────── */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        size={860}
        padding={0}
        radius={0}
        withCloseButton={false}
        zIndex={500}
        overlayProps={{ backgroundOpacity: 0.55, color: '#0F142A', blur: 2 }}
        styles={{
          content: {
            background: 'var(--sny-paper)',
            border: '1px solid var(--sny-hairline)',
            boxShadow: '0 30px 60px rgba(15, 20, 42, 0.35)',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
          },
          body: {
            padding: 0,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        {viewing && (
          <Tabs
            defaultValue="report"
            styles={{
              root: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', height: '100%' },
              panel: { flex: 1, overflow: 'hidden' },
            }}
          >
            {/* Tab bar with inline close button */}
            <Tabs.List
              style={{
                flexShrink: 0,
                borderBottom: '1px solid var(--sny-hairline)',
                background: 'var(--sny-paper-highlight)',
                padding: '0 24px',
              }}
            >
              <Tabs.Tab value="report" styles={TAB_STYLES}>Evaluation</Tabs.Tab>
              <Tabs.Tab value="chat" styles={TAB_STYLES}>Chat log</Tabs.Tab>
              <Box style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                <ActionIcon
                  variant="subtle" size="sm" radius={0} onClick={closeModal}
                  title="Close" styles={{ root: { color: 'var(--sny-ink-soft)' } }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </ActionIcon>
              </Box>
            </Tabs.List>

            <Tabs.Panel value="report">
              <ScrollArea style={{ height: 'calc(92vh - 49px)' }}>
                <EvaluationContent
                  report={viewing.evaluation}
                  coach={viewing.coach}
                  scenarioInfo={viewing.scenarioInfo}
                  sessionResult={null}
                  onNewSession={closeModal}
                  onStartRecommended={viewing.coach ? handleStartRecommended : null}
                  startingRecommended={startingRecommended}
                  startRecommendationError={startRecommendationError}
                  innerScroll={false}
                />
              </ScrollArea>
            </Tabs.Panel>

            <Tabs.Panel value="chat">
              <ScrollArea style={{ height: 'calc(92vh - 49px)' }}>
                <TranscriptView record={viewing} />
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
        )}
      </Modal>
    </Stack>
  );
}
