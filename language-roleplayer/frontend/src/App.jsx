import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  Anchor,
  Badge,
  Box,
  Container,
  Group,
  Text,
} from '@mantine/core';
import ScenarioBrowser from './pages/ScenarioBrowser';
import ConversationPage from './pages/ConversationPage';
import CreateScenarioPage from './pages/CreateScenarioPage';
import VocabBankPage from './pages/VocabBankPage';
import { getStreak, getXP } from './utils/storage';

function Navbar() {
  const location = useLocation();
  const isConversation = location.pathname.startsWith('/conversation');
  const [streak, setStreak] = useState(getStreak());
  const [xp, setXP] = useState(getXP());

  useEffect(() => {
    setStreak(getStreak());
    setXP(getXP());
  }, [location.pathname]);

  if (isConversation) return null;

  const link = (to, label) => {
    const active = location.pathname === to;
    return (
      <Anchor
        component={Link}
        to={to}
        underline="never"
        fz="sm"
        fw={500}
        px="sm"
        py={6}
        style={{ borderRadius: 8 }}
        c={active ? 'white' : 'rgba(255,255,255,0.75)'}
        bg={active ? 'rgba(255,255,255,0.12)' : 'transparent'}
      >
        {label}
      </Anchor>
    );
  };

  return (
    <Box
      component="header"
      bg="brand.9"
      c="white"
      py="md"
      px={{ base: 'md', sm: 'xl' }}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 200,
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
      }}
    >
      <Group justify="space-between" wrap="nowrap" maw={1280} mx="auto">
        <Anchor
          component={Link}
          to="/"
          underline="never"
          display="flex"
          align="center"
          gap="sm"
          c="white"
        >
          <Text span fz="xl">
            🌍
          </Text>
          <Text fw={700} fz="lg" style={{ letterSpacing: '-0.01em' }}>
            Saynario
          </Text>
        </Anchor>

        <Group gap={4} visibleFrom="xs" justify="center" style={{ flex: 1 }}>
          {link('/', 'Scenarios')}
          {link('/create', '+ Create')}
          {link('/vocab', 'Vocab Bank')}
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Badge
            variant="light"
            color="gold"
            size="lg"
            radius="xl"
            title="Current streak"
            leftSection="🔥"
          >
            {streak}
          </Badge>
          <Badge
            variant="light"
            color="brand"
            size="lg"
            radius="xl"
            title="Total XP earned"
            leftSection="⚡"
            visibleFrom="sm"
          >
            {xp} XP
          </Badge>
        </Group>
      </Group>

      <Group gap={4} justify="center" mt="sm" hiddenFrom="xs">
        {link('/', 'Scenarios')}
        {link('/create', 'Create')}
        {link('/vocab', 'Vocab')}
      </Group>
    </Box>
  );
}

function AppContent() {
  const location = useLocation();
  const isConversation = location.pathname.startsWith('/conversation');

  return (
    <Box mih="100vh" display="flex" style={{ flexDirection: 'column' }}>
      <Navbar />
      <Box
        component="main"
        style={{ flex: 1 }}
        py={isConversation ? 0 : 'xl'}
        px={isConversation ? 0 : { base: 'md', sm: 'xl' }}
      >
        {isConversation ? (
          <Routes>
            <Route path="/conversation/:sessionId" element={<ConversationPage />} />
          </Routes>
        ) : (
          <Container size={1280} px={0}>
            <Routes>
              <Route path="/" element={<ScenarioBrowser />} />
              <Route path="/create" element={<CreateScenarioPage />} />
              <Route path="/vocab" element={<VocabBankPage />} />
            </Routes>
          </Container>
        )}
      </Box>
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
