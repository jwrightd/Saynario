import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Drawer,
  Group,
  Modal,
  Stack,
  Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { recordSession, computeXP } from '../utils/storage';
import { scenarioBannerBackground, scenarioMoodName } from '../utils/scenarioBanner';

const LANG_CITIES = {
  en: 'London', fr: 'Paris', es: 'Seville', de: 'Berlin',
  ja: 'Kyoto', zh: 'Shanghai', it: 'Rome', pt: 'Lisbon', ko: 'Seoul',
};

const LANG_CODES = {
  en: 'EN', fr: 'FR', es: 'ES', de: 'DE', ja: 'JA',
  zh: 'ZH', it: 'IT', pt: 'PT', ko: 'KO',
};

/** Small stat line styled like a ledger entry. */
function Stat({ label, value, suffix, accent = 'ink' }) {
  const color =
    accent === 'olive'
      ? 'var(--sny-olive)'
      : accent === 'clay'
        ? 'var(--sny-clay)'
        : accent === 'gilt'
          ? 'var(--sny-gilt)'
          : 'var(--sny-ink)';
  return (
    <Box>
      <Text
        fz={10}
        fw={700}
        c="ink.6"
        style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
      >
        {label}
      </Text>
      <Group gap={6} align="baseline" mt={4}>
        <Text
          className="sny-serif"
          fz={44}
          fw={500}
          c={color}
          style={{ lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Text>
        {suffix && (
          <Text fz="sm" c="ink.6">
            {suffix}
          </Text>
        )}
      </Group>
    </Box>
  );
}

function ScoreDial({ score }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let start = null;
    const duration = 1100;
    let raf;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * score));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * 0.72;
  const strokeDash = (displayed / 100) * arc;

  const color =
    score >= 80
      ? 'var(--sny-olive)'
      : score >= 55
        ? 'var(--sny-gilt)'
        : 'var(--sny-clay)';

  return (
    <svg
      viewBox="0 0 160 160"
      width={180}
      height={180}
      style={{ display: 'block' }}
      aria-label="Overall score"
    >
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke="rgba(31, 39, 72, 0.1)"
        strokeWidth="3"
        strokeDasharray={`${arc} ${circumference}`}
        strokeLinecap="butt"
        transform="rotate(140 80 80)"
      />
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={`${strokeDash} ${circumference}`}
        strokeLinecap="butt"
        transform="rotate(140 80 80)"
        style={{ transition: 'stroke-dasharray 0.05s linear' }}
      />
      {/* Tiny tick marks at the ends */}
      <text
        x="80"
        y="82"
        textAnchor="middle"
        fontSize="42"
        fontFamily='"Cormorant Garamond", Georgia, serif'
        fontWeight="500"
        fill="var(--sny-ink)"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {displayed}
      </text>
      <text
        x="80"
        y="104"
        textAnchor="middle"
        fontSize="10"
        letterSpacing="3"
        fill="var(--sny-ink-soft)"
      >
        OF 100
      </text>
    </svg>
  );
}

function Horizon({ value, color }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <Box
      style={{
        height: 3,
        background: 'rgba(31, 39, 72, 0.1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        style={{
          position: 'absolute',
          inset: 0,
          width: `${pct}%`,
          background: color,
          transition: 'width 0.8s ease',
        }}
      />
    </Box>
  );
}

function CorrectionNote({ item, index }) {
  return (
    <Box
      className="sny-anim-fade-in"
      style={{
        animationDelay: `${index * 0.05}s`,
        paddingLeft: 16,
        borderLeft: '2px solid var(--sny-clay)',
        paddingTop: 8,
        paddingBottom: 8,
      }}
    >
      <Group gap={10} align="baseline" wrap="nowrap">
        <Text
          fz={10}
          fw={700}
          c="ink.6"
          style={{ letterSpacing: '0.18em', textTransform: 'uppercase', flexShrink: 0 }}
        >
          You said
        </Text>
        <Text
          fz={15}
          className="sny-serif"
          fs="italic"
          td="line-through"
          c="clay.7"
          style={{ flex: 1, lineHeight: 1.4 }}
        >
          {item.original}
        </Text>
      </Group>
      <Group gap={10} align="baseline" wrap="nowrap" mt={4}>
        <Text
          fz={10}
          fw={700}
          c="ink.6"
          style={{ letterSpacing: '0.18em', textTransform: 'uppercase', flexShrink: 0 }}
        >
          Atelier
        </Text>
        <Text
          fz={15}
          className="sny-serif"
          fs="italic"
          c="olive.7"
          fw={600}
          style={{ flex: 1, lineHeight: 1.4 }}
        >
          {item.corrected}
        </Text>
      </Group>
      {item.explanation && (
        <Text fz="sm" c="ink.6" mt={8} style={{ lineHeight: 1.55 }}>
          {item.rule && (
            <Text span fw={600} c="ink.8">
              {item.rule}.{' '}
            </Text>
          )}
          {item.explanation}
        </Text>
      )}
    </Box>
  );
}

function SectionHead({ kicker, title }) {
  return (
    <Stack gap={2} mb="sm">
      <Text
        fz={10}
        fw={700}
        c="clay.6"
        style={{ letterSpacing: '0.28em', textTransform: 'uppercase' }}
      >
        {kicker}
      </Text>
      <Text
        className="sny-serif"
        fz={22}
        fw={500}
        c="ink.8"
        style={{ lineHeight: 1.15, letterSpacing: '-0.01em' }}
      >
        {title}
      </Text>
    </Stack>
  );
}

function EvaluationContent({ report, scenarioInfo, sessionResult, onNewSession }) {
  const overall = Math.round(report.overall_score || 0);
  const vocab = Math.round(report.vocabulary_score || 0);
  const naturalness = Math.round(report.naturalness_score || 0);
  const taskDone = report.task_completion;
  const lang = scenarioInfo?.target_language || 'fr';
  const city = LANG_CITIES[lang] || 'Atelier';
  const moodName = scenarioMoodName(lang);
  const banner = scenarioBannerBackground(lang);

  return (
    <Box style={{ background: 'var(--sny-paper)' }}>
      {/* ── Masthead of the report ─────────────────────────────────── */}
      <Box
        style={{
          position: 'relative',
          background: banner,
          color: 'var(--sny-paper-highlight)',
          padding: '32px 40px',
          overflow: 'hidden',
        }}
      >
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.14 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
            mixBlendMode: 'overlay',
            opacity: 0.6,
            pointerEvents: 'none',
          }}
        />
        <Box style={{ position: 'relative' }}>
          <Text
            fz={10}
            fw={700}
            style={{
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: 'rgba(251, 247, 240, 0.88)',
            }}
          >
            · {city} · {LANG_CODES[lang] || ''} · {moodName} ·
          </Text>
          <Text
            className="sny-serif"
            fz={{ base: 28, sm: 40 }}
            fw={500}
            mt={8}
            style={{
              lineHeight: 1.08,
              letterSpacing: '-0.015em',
              color: 'var(--sny-paper-highlight)',
              maxWidth: 600,
            }}
          >
            {taskDone ? 'A scene well played.' : 'A rehearsal with promise.'}
          </Text>
          <Text
            mt={10}
            fz="sm"
            style={{
              color: 'rgba(251, 247, 240, 0.82)',
              lineHeight: 1.6,
              maxWidth: 560,
            }}
          >
            {scenarioInfo?.title || 'Your conversation'} is complete.
            {sessionResult && (
              <>
                {' '}You earned{' '}
                <Text span fw={700} style={{ color: '#F5E2B1' }}>
                  +{sessionResult.xpEarned} XP
                </Text>
                {' '}·{' '}
                <Text span fw={600} style={{ color: '#F5E2B1' }}>
                  streak of {sessionResult.newStreak}
                </Text>
              </>
            )}
          </Text>
        </Box>
      </Box>

      {/* ── Score slab ─────────────────────────────────────────────── */}
      <Box
        px={{ base: 'lg', sm: 40 }}
        py={32}
        style={{ borderBottom: '1px solid var(--sny-hairline)' }}
      >
        <Group align="center" gap={40} wrap="wrap" justify="space-between">
          <Stack align="center" gap={6}>
            <ScoreDial score={overall} />
            <Text
              fz={10}
              fw={700}
              c="ink.6"
              style={{ letterSpacing: '0.28em', textTransform: 'uppercase' }}
            >
              Overall
            </Text>
            {report.cefr_estimate && (
              <Text
                fz={11}
                fw={700}
                c="clay.7"
                px={8}
                py={3}
                style={{
                  letterSpacing: '0.2em',
                  border: '1px solid var(--sny-clay)',
                  background: 'rgba(193, 87, 63, 0.06)',
                }}
              >
                CEFR · {report.cefr_estimate}
              </Text>
            )}
          </Stack>

          <Stack gap={24} style={{ flex: 1, minWidth: 260 }}>
            <Box>
              <Stat
                label="Vocabulary"
                value={vocab}
                suffix="/ 100"
                accent="ink"
              />
              <Box mt={10}>
                <Horizon value={vocab} color="var(--sny-ink)" />
              </Box>
            </Box>
            <Box>
              <Stat
                label="Naturalness"
                value={naturalness}
                suffix="/ 100"
                accent="olive"
              />
              <Box mt={10}>
                <Horizon value={naturalness} color="var(--sny-olive)" />
              </Box>
            </Box>
            <Box>
              <Text
                fz={10}
                fw={700}
                c="ink.6"
                style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
              >
                Task
              </Text>
              <Text
                className="sny-serif"
                fz={22}
                fw={500}
                c={taskDone ? 'olive.7' : 'clay.7'}
                mt={4}
                fs="italic"
              >
                {taskDone ? 'Accomplished' : 'Unfinished'}
              </Text>
            </Box>
          </Stack>
        </Group>
      </Box>

      {/* ── Detailed coaching letter ───────────────────────────────── */}
      <Stack
        px={{ base: 'lg', sm: 40 }}
        py={32}
        gap={40}
        style={{
          maxHeight: 'min(56vh, 520px)',
          overflowY: 'auto',
        }}
      >
        {report.grammar_errors?.length > 0 && (
          <Box>
            <SectionHead kicker="Notes from the margin" title="Corrections" />
            <Stack gap={14}>
              {report.grammar_errors.map((err, i) => (
                <CorrectionNote key={i} item={err} index={i} />
              ))}
            </Stack>
          </Box>
        )}

        {report.strengths?.length > 0 && (
          <Box>
            <SectionHead kicker="The good bones" title="What you did well" />
            <Stack gap={10}>
              {report.strengths.map((s, i) => (
                <Group key={i} gap={10} wrap="nowrap" align="baseline">
                  <Text
                    fz={10}
                    fw={700}
                    c="olive.7"
                    style={{ letterSpacing: '0.22em', flexShrink: 0 }}
                  >
                    · {String(i + 1).padStart(2, '0')}
                  </Text>
                  <Text fz="sm" c="ink.7" style={{ lineHeight: 1.6 }}>
                    {s}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Box>
        )}

        {report.improvement_areas?.length > 0 && (
          <Box>
            <SectionHead kicker="For next time" title="Places to polish" />
            <Stack gap={10}>
              {report.improvement_areas.map((a, i) => (
                <Group key={i} gap={10} wrap="nowrap" align="baseline">
                  <Text
                    fz={10}
                    fw={700}
                    c="clay.6"
                    style={{ letterSpacing: '0.22em', flexShrink: 0 }}
                  >
                    · {String(i + 1).padStart(2, '0')}
                  </Text>
                  <Text fz="sm" c="ink.7" style={{ lineHeight: 1.6 }}>
                    {a}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Box>
        )}

        {report.suggested_vocabulary?.length > 0 && (
          <Box>
            <SectionHead kicker="To carry with you" title="Suggested vocabulary" />
            <Group gap={8}>
              {report.suggested_vocabulary.map((v, i) => (
                <Text
                  key={i}
                  fz="sm"
                  fw={500}
                  className="sny-serif"
                  c="ink.8"
                  fs="italic"
                  px={10}
                  py={5}
                  style={{
                    border: '1px solid var(--sny-hairline)',
                    background: 'var(--sny-paper-highlight)',
                  }}
                >
                  {v}
                </Text>
              ))}
            </Group>
          </Box>
        )}

        {report.cultural_notes && (
          <Box>
            <SectionHead kicker="A note from the atelier" title="Cultural context" />
            <Box
              px="md"
              py="md"
              style={{
                borderLeft: '2px solid var(--sny-gilt)',
                background: 'rgba(184, 134, 42, 0.06)',
              }}
            >
              <Text
                className="sny-serif"
                fs="italic"
                fz={16}
                c="ink.7"
                style={{ lineHeight: 1.6 }}
              >
                {report.cultural_notes}
              </Text>
            </Box>
          </Box>
        )}
      </Stack>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <Box
        px={{ base: 'lg', sm: 40 }}
        py="lg"
        style={{ borderTop: '1px solid var(--sny-hairline)' }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Text fz={10} c="ink.6" style={{ letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Debrief · Saynario Atelier
          </Text>
          <Button
            onClick={onNewSession}
            color="clay.6"
            radius={0}
            size="md"
            styles={{
              root: {
                letterSpacing: '0.04em',
                fontWeight: 600,
              },
            }}
          >
            Choose another scene →
          </Button>
        </Group>
      </Box>
    </Box>
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
        size="94%"
        padding={0}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        zIndex={1000}
        styles={{
          content: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
        }}
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
      size={820}
      padding={0}
      radius={0}
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      zIndex={500}
      overlayProps={{
        backgroundOpacity: 0.6,
        color: '#0F142A',
        blur: 2,
      }}
      styles={{
        content: {
          background: 'var(--sny-paper)',
          border: '1px solid var(--sny-hairline)',
          boxShadow: '0 30px 60px rgba(15, 20, 42, 0.35)',
        },
      }}
    >
      {body}
    </Modal>
  );
}
