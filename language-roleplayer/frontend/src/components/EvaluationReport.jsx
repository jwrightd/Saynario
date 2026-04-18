import { useState, useEffect } from 'react';
import {
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Modal,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { recordSession, computeXP } from '../utils/storage';

const LANG_FLAGS = {
  en: '🇬🇧', fr: '🇫🇷', es: '🇪🇸', de: '🇩🇪', ja: '🇯🇵',
  zh: '🇨🇳', it: '🇮🇹', pt: '🇧🇷', ko: '🇰🇷',
};

function ScoreGauge({ score }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let start = null;
    const duration = 1200;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setDisplayed(Math.round(progress * score));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * 0.75;
  const strokeDash = (displayed / 100) * arc;

  const color = score >= 80 ? '#1ABC9C' : score >= 55 ? '#F0A500' : '#E74C3C';

  return (
    <div className="eval-score-gauge">
      <svg viewBox="0 0 120 120" width={140} height={140}>
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#E5E8E8"
          strokeWidth="12"
          strokeDasharray={`${arc} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(135 60 60)"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${strokeDash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(135 60 60)"
          style={{ transition: 'stroke-dasharray 0.05s linear' }}
        />
        <text x="60" y="55" textAnchor="middle" fontSize="22" fontWeight="700" fill="#1A252F">
          {displayed}
        </text>
        <text x="60" y="72" textAnchor="middle" fontSize="10" fill="#566573">
          / 100
        </text>
      </svg>
    </div>
  );
}

function GrammarCard({ item, index }) {
  return (
    <Paper
      p="md"
      radius="sm"
      withBorder
      bg="gray.0"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: 'var(--mantine-color-red-5)',
        animation: `fadeIn 0.3s ease ${index * 0.05}s both`,
      }}
    >
      <Group gap="xs" align="baseline" wrap="nowrap">
        <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ flexShrink: 0 }}>You said</Text>
        <Text fz="sm" fw={500} ff="'DM Sans', sans-serif" td="line-through" c="red.7" style={{ flex: 1 }}>
          {item.original}
        </Text>
      </Group>
      <Text fz="xs" c="dimmed" my={4}>→</Text>
      <Group gap="xs" align="baseline" wrap="nowrap">
        <Text fz={10} fw={700} tt="uppercase" c="dimmed" style={{ flexShrink: 0 }}>Correct</Text>
        <Text fz="sm" fw={600} ff="'DM Sans', sans-serif" c="teal.7" style={{ flex: 1 }}>
          {item.corrected}
        </Text>
      </Group>
      {item.explanation && (
        <Text fz="sm" c="dimmed" mt="sm">
          <Text span fw={600}>{item.rule}:</Text> {item.explanation}
        </Text>
      )}
    </Paper>
  );
}

function EvaluationContent({ report, scenarioInfo, sessionResult, onNewSession }) {
  const overall = Math.round(report.overall_score || 0);
  const vocab = Math.round(report.vocabulary_score || 0);
  const naturalness = Math.round(report.naturalness_score || 0);
  const taskDone = report.task_completion;
  const lang = scenarioInfo?.target_language || 'fr';
  const flag = LANG_FLAGS[lang] || '🌐';

  return (
    <Stack gap={0}>
      <Paper
        p="xl"
        radius={0}
        style={{
          background: taskDone
            ? 'linear-gradient(135deg, #0D1B2A, #1B4F72)'
            : 'linear-gradient(135deg, #2c3e50, #4a5568)',
          color: 'white',
        }}
      >
        <Group align="flex-start" wrap="nowrap" gap="md">
          <Text fz="2.5rem" style={{ flexShrink: 0 }}>{taskDone ? '🎉' : '💪'}</Text>
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Title order={2} c="white" fz="h3">
              {taskDone ? 'Mission accomplished!' : 'Good effort!'}
            </Title>
            <Text fz="sm" c="rgba(255,255,255,0.85)">
              {flag} {scenarioInfo?.title || 'Conversation'} complete
              {sessionResult && (
                <Text span fw={700} c="#F0A500"> · +{sessionResult.xpEarned} XP</Text>
              )}
            </Text>
          </Stack>
          {sessionResult && (
            <Badge size="lg" variant="light" color="gold" style={{ flexShrink: 0 }}>
              🔥 {sessionResult.newStreak} day streak
            </Badge>
          )}
        </Group>
      </Paper>

      <Group
        align="center"
        gap="xl"
        p="lg"
        wrap="wrap"
        justify="center"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Stack align="center" gap="xs">
          <ScoreGauge score={overall} />
          <Badge size="lg" color="brand" variant="filled">{report.cefr_estimate || 'N/A'}</Badge>
          <Text fz="xs" c="dimmed" fw={600}>Overall score</Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" style={{ flex: 1, minWidth: 200 }}>
          <Stack gap={6} align="center">
            <Text fz="xl" fw={700} c="brand.9">{vocab}</Text>
            <Text fz="xs" c="dimmed" ta="center">Vocabulary</Text>
            <Progress value={vocab} color="brand" size="sm" radius="xl" />
          </Stack>
          <Stack gap={6} align="center">
            <Text fz="xl" fw={700} c="brand.9">{naturalness}</Text>
            <Text fz="xs" c="dimmed" ta="center">Naturalness</Text>
            <Progress value={naturalness} color="teal" size="sm" radius="xl" />
          </Stack>
          <Stack gap={6} align="center">
            <Text fz="xl" fw={700} c={taskDone ? 'teal.7' : 'red.7'}>
              {taskDone ? '✓' : '✗'}
            </Text>
            <Text fz="xs" c="dimmed" ta="center">Task complete</Text>
          </Stack>
        </SimpleGrid>
      </Group>

      <Stack p="lg" gap="xl" style={{ maxHeight: 'min(55vh, 480px)', overflowY: 'auto' }}>
        {report.grammar_errors?.length > 0 && (
          <div>
            <Title order={4} c="brand.9" mb="md">Grammar corrections</Title>
            <Stack gap="md">
              {report.grammar_errors.map((err, i) => (
                <GrammarCard key={i} item={err} index={i} />
              ))}
            </Stack>
          </div>
        )}

        {report.strengths?.length > 0 && (
          <div>
            <Title order={4} c="brand.9" mb="sm">Strengths</Title>
            <Stack gap="xs">
              {report.strengths.map((s, i) => (
                <Text key={i} fz="sm" c="teal.8">✨ {s}</Text>
              ))}
            </Stack>
          </div>
        )}

        {report.improvement_areas?.length > 0 && (
          <div>
            <Title order={4} c="brand.9" mb="sm">Areas to improve</Title>
            <Stack gap="xs">
              {report.improvement_areas.map((a, i) => (
                <Text key={i} fz="sm" c="dimmed">→ {a}</Text>
              ))}
            </Stack>
          </div>
        )}

        {report.suggested_vocabulary?.length > 0 && (
          <div>
            <Title order={4} c="brand.9" mb="sm">Suggested vocabulary</Title>
            <Group gap="xs">
              {report.suggested_vocabulary.map((v, i) => (
                <Badge key={i} variant="light" color="brand" size="lg">{v}</Badge>
              ))}
            </Group>
          </div>
        )}

        {report.cultural_notes && (
          <div>
            <Title order={4} c="brand.9" mb="sm">Cultural notes</Title>
            <Paper p="md" radius="sm" withBorder bg="gray.0" style={{ borderLeftWidth: 3, borderLeftColor: 'var(--mantine-color-gold-5)' }}>
              <Text fz="sm" lh={1.6}>{report.cultural_notes}</Text>
            </Paper>
          </div>
        )}
      </Stack>

      <Divider />

      <Group justify="center" p="lg">
        <Button size="md" onClick={onNewSession}>
          New scenario
        </Button>
      </Group>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </Stack>
  );
}

export default function EvaluationReport({ report, scenarioInfo, onNewSession }) {
  const [sessionResult, setSessionResult] = useState(null);
  const isMobile = useMediaQuery('(max-width: 48em)');

  useEffect(() => {
    if (!report) return;
    const xpEarned = computeXP(report.overall_score || 0);
    const result = recordSession(xpEarned);
    setSessionResult({ ...result, xpEarned });
  }, [report]);

  if (!report) return null;

  const body = (
    <EvaluationContent
      report={report}
      scenarioInfo={scenarioInfo}
      sessionResult={sessionResult}
      onNewSession={onNewSession}
    />
  );

  if (isMobile) {
    return (
      <Drawer
        opened
        onClose={() => {}}
        position="bottom"
        size="92%"
        padding={0}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        zIndex={1000}
        styles={{ content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 } }}
      >
        {body}
      </Drawer>
    );
  }

  return (
    <Modal
      opened
      onClose={() => {}}
      centered
      size="xl"
      padding={0}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      zIndex={500}
      overlayProps={{ backgroundOpacity: 0.55, blur: 4 }}
    >
      <Paper radius="md" withBorder shadow="xl" overflow="hidden">
        {body}
      </Paper>
    </Modal>
  );
}
