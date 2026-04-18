import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  Anchor,
  Box,
  Container,
  Group,
  Text,
  UnstyledButton,
} from '@mantine/core';
import ScenarioBrowser from './pages/ScenarioBrowser';
import ConversationPage from './pages/ConversationPage';
import CreateScenarioPage from './pages/CreateScenarioPage';
import VocabBankPage from './pages/VocabBankPage';
import HistoryPage from './pages/HistoryPage';
import { getStreak, getXP } from './utils/storage';

/**
 * Saynario header — an editorial masthead.
 *
 * Intent:
 *   - Feels like opening a travel journal, not a SaaS app.
 *   - Serif wordmark, fine rule, quiet streak ledger in the corner.
 *   - Hidden on the conversation page, which should feel immersive.
 */
function Masthead() {
  const location = useLocation();
  const isConversation = location.pathname.startsWith('/conversation');
  const [streak, setStreak] = useState(getStreak());
  const [xp, setXP] = useState(getXP());

  useEffect(() => {
    setStreak(getStreak());
    setXP(getXP());
  }, [location.pathname]);

  if (isConversation) return null;

  const navLink = (to, label) => {
    const active =
      to === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(to);
    return (
      <Anchor
        key={to}
        component={Link}
        to={to}
        underline="never"
        fz="sm"
        fw={500}
        px={10}
        py={8}
        c={active ? 'ink.8' : 'ink.6'}
        style={{
          position: 'relative',
          letterSpacing: '0.02em',
          transition: 'color 0.15s ease',
        }}
      >
        {label}
        {active && (
          <Box
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              bottom: 2,
              height: 2,
              background: 'var(--sny-clay)',
              borderRadius: 0,
            }}
          />
        )}
      </Anchor>
    );
  };

  return (
    <Box
      component="header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 200,
        background: 'rgba(247, 241, 229, 0.88)',
        backdropFilter: 'saturate(1.1) blur(10px)',
        WebkitBackdropFilter: 'saturate(1.1) blur(10px)',
        borderBottom: '1px solid var(--sny-hairline)',
      }}
    >
      <Container size={1200} px={{ base: 'md', sm: 'lg' }} py="sm">
        <Group justify="space-between" wrap="nowrap" align="center">
          <Anchor
            component={Link}
            to="/"
            underline="never"
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 10,
              color: 'var(--sny-ink)',
            }}
          >
            <Text
              fz={26}
              fw={500}
              className="sny-serif"
              style={{
                letterSpacing: '-0.01em',
                lineHeight: 1,
              }}
            >
              Saynario
            </Text>
            <Text
              fz={10}
              c="ink.6"
              style={{
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
              visibleFrom="xs"
            >
              Atelier&nbsp;·&nbsp;Travel&nbsp;·&nbsp;Voice
            </Text>
          </Anchor>

          <Group gap={2} visibleFrom="sm">
            {navLink('/', 'Destinations')}
            {navLink('/create', 'Compose')}
            {navLink('/vocab', 'Lexicon')}
            {navLink('/history', 'Archive')}
          </Group>

          <Group gap="sm" wrap="nowrap" align="center">
            <LedgerChip
              label="streak"
              value={`${streak}`}
              accent="clay"
              title="Current daily streak"
            />
            <Box visibleFrom="xs">
              <LedgerChip
                label="journal xp"
                value={`${xp}`}
                accent="gilt"
                title="Total XP earned"
              />
            </Box>
          </Group>
        </Group>

        {/* Mobile nav row */}
        <Group gap={4} justify="center" mt={8} hiddenFrom="sm">
          {navLink('/', 'Destinations')}
          {navLink('/create', 'Compose')}
          {navLink('/vocab', 'Lexicon')}
          {navLink('/history', 'Archive')}
        </Group>
      </Container>
    </Box>
  );
}

function LedgerChip({ label, value, accent = 'ink', title }) {
  const accentColor =
    accent === 'clay'
      ? 'var(--sny-clay)'
      : accent === 'gilt'
        ? 'var(--sny-gilt)'
        : 'var(--sny-ink)';
  return (
    <Box
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px 6px 8px',
        border: '1px solid var(--sny-hairline)',
        background: 'var(--sny-paper-highlight)',
      }}
    >
      <Box
        w={6}
        h={6}
        style={{
          borderRadius: '50%',
          background: accentColor,
          boxShadow: `0 0 0 2px ${accentColor}22`,
        }}
      />
      <Text
        fz={10}
        fw={600}
        c="ink.6"
        style={{ letterSpacing: '0.18em', textTransform: 'uppercase' }}
      >
        {label}
      </Text>
      <Text fz="sm" fw={700} c="ink.8" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
    </Box>
  );
}

function AppContent() {
  const location = useLocation();
  const isConversation = location.pathname.startsWith('/conversation');

  return (
    <Box
      mih="100vh"
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Masthead />
      <Box
        component="main"
        style={{ flex: 1, width: '100%' }}
        py={isConversation ? 0 : 40}
        px={isConversation ? 0 : undefined}
      >
        {isConversation ? (
          <Routes>
            <Route path="/conversation/:sessionId" element={<ConversationPage />} />
          </Routes>
        ) : (
          <Container size={1200} px={{ base: 'md', sm: 'lg' }}>
            <Routes>
              <Route path="/" element={<ScenarioBrowser />} />
              <Route path="/create" element={<CreateScenarioPage />} />
              <Route path="/vocab" element={<VocabBankPage />} />
              <Route path="/history" element={<HistoryPage />} />
            </Routes>
          </Container>
        )}
      </Box>
      {!isConversation && (
        <Box
          component="footer"
          mt={64}
          py="lg"
          style={{
            borderTop: '1px solid var(--sny-hairline)',
            color: 'var(--sny-ink-soft)',
          }}
        >
          <Container size={1200} px={{ base: 'md', sm: 'lg' }}>
            <Group justify="space-between" wrap="wrap" gap="sm">
              <Text fz="xs" c="ink.6" style={{ letterSpacing: '0.04em' }}>
                Saynario · boutique travel atelier for voice-first language practice
              </Text>
              <Text fz="xs" c="ink.6" className="sny-serif" fs="italic">
                Édition n°IV
              </Text>
            </Group>
          </Container>
        </Box>
      )}
    </Box>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
