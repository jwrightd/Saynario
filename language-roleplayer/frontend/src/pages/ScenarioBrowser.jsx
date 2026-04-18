import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Center,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import ScenarioCard from '../components/ScenarioCard';
import { getScenarios, createSession } from '../utils/api';
import { getCustomScenarios, deleteCustomScenario } from '../utils/storage';

const LANGUAGES = [
  { value: '',   label: 'All' },
  { value: 'en', label: 'English',   city: 'London' },
  { value: 'fr', label: 'French',    city: 'Paris' },
  { value: 'es', label: 'Spanish',   city: 'Seville' },
  { value: 'de', label: 'German',    city: 'Berlin' },
  { value: 'ja', label: 'Japanese',  city: 'Kyoto' },
  { value: 'zh', label: 'Chinese',   city: 'Shanghai' },
  { value: 'it', label: 'Italian',   city: 'Rome' },
  { value: 'pt', label: 'Portuguese',city: 'Lisbon' },
  { value: 'ko', label: 'Korean',    city: 'Seoul' },
];

const DIFFICULTIES = [
  { value: '',             label: 'All levels' },
  { value: 'beginner',     label: 'Gentle' },
  { value: 'intermediate', label: 'Measured' },
  { value: 'advanced',     label: 'Immersive' },
];

function FilterChip({ active, onClick, label, sub }) {
  return (
    <UnstyledButton
      onClick={onClick}
      px={12}
      py={8}
      style={{
        border: active
          ? '1px solid var(--sny-clay)'
          : '1px solid var(--sny-hairline)',
        background: active
          ? 'rgba(193, 87, 63, 0.08)'
          : 'var(--sny-paper-highlight)',
        color: active ? 'var(--sny-clay-deep)' : 'var(--sny-ink)',
        transition: 'all 0.15s ease',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
      }}
    >
      <Text
        fz={12}
        fw={600}
        style={{ letterSpacing: '0.04em' }}
      >
        {label}
      </Text>
      {sub && (
        <Text
          fz={10}
          c={active ? 'clay.6' : 'ink.5'}
          style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}
        >
          {sub}
        </Text>
      )}
    </UnstyledButton>
  );
}

export default function ScenarioBrowser() {
  const [scenarios, setScenarios] = useState([]);
  const [customScenarios, setCustomScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(null);
  const [language, setLanguage] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadScenarios();
    setCustomScenarios(getCustomScenarios());
  }, [language, difficulty]);

  async function loadScenarios() {
    try {
      setLoading(true);
      setError(null);
      const data = await getScenarios(language || undefined, difficulty || undefined);
      setScenarios(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleScenarioClick(scenarioId) {
    if (starting) return;
    try {
      setStarting(scenarioId);
      setError(null);
      const session = await createSession(scenarioId);
      navigate(`/conversation/${session.id}`);
    } catch (err) {
      setError(`Could not start session: ${err.message}`);
      setStarting(null);
    }
  }

  async function handleCustomScenarioClick(scenario) {
    if (starting) return;
    try {
      setStarting(scenario.id);
      setError(null);
      const session = await createSession(null, scenario);
      navigate(`/conversation/${session.id}`);
    } catch (err) {
      setError(`Could not start session: ${err.message}`);
      setStarting(null);
    }
  }

  function handleDeleteCustom(id) {
    deleteCustomScenario(id);
    setCustomScenarios(getCustomScenarios());
  }

  const filteredCustom = customScenarios.filter((s) => {
    if (language && s.target_language !== language) return false;
    if (difficulty && s.difficulty !== difficulty) return false;
    return true;
  });

  const allEmpty = !loading && scenarios.length === 0 && filteredCustom.length === 0;

  return (
    <Stack gap={40} className="sny-anim-fade-soft">
      {/* ── Editorial masthead block ─────────────────────────────────────── */}
      <Box>
        <Text
          fz={10}
          fw={700}
          c="clay.6"
          mb={12}
          style={{ letterSpacing: '0.3em', textTransform: 'uppercase' }}
        >
          · N° {new Date().getFullYear()} · The Atelier Journal
        </Text>
        <Text
          className="sny-serif"
          fz={{ base: 44, sm: 58, md: 72 }}
          fw={500}
          c="ink.8"
          style={{
            lineHeight: 1.02,
            letterSpacing: '-0.02em',
            maxWidth: 900,
          }}
        >
          Step into a scene.
          <br />
          <Text
            span
            inherit
            fs="italic"
            c="clay.6"
            style={{ fontWeight: 500 }}
          >
            Practice aloud.
          </Text>
        </Text>
        <Text
          mt="md"
          fz="md"
          c="ink.6"
          maw={640}
          style={{ lineHeight: 1.65 }}
        >
          A boutique collection of voice-first roleplays — ordering a pastry in
          Paris, bargaining at a market in Seville, checking into a ryokan in
          Kyoto. Choose a destination, meet your character, and let the
          conversation unfold.
        </Text>
      </Box>

      {/* ── Filters as a fine ledger strip ───────────────────────────────── */}
      <Box
        px="md"
        py="md"
        style={{
          background: 'var(--sny-paper-highlight)',
          border: '1px solid var(--sny-hairline)',
        }}
      >
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text
              fz={10}
              fw={700}
              c="ink.6"
              style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
            >
              Destination
            </Text>
            <Text fz={10} c="ink.5" style={{ letterSpacing: '0.08em' }}>
              Filter the collection
            </Text>
          </Group>
          <Group gap={6}>
            {LANGUAGES.map((l) => (
              <FilterChip
                key={l.value || 'all'}
                active={language === l.value}
                onClick={() => setLanguage(l.value)}
                label={l.label}
                sub={l.city}
              />
            ))}
          </Group>
          <Box
            mt={6}
            pt="sm"
            style={{ borderTop: '1px solid var(--sny-hairline-soft)' }}
          >
            <Group justify="space-between" align="center" mb={8}>
              <Text
                fz={10}
                fw={700}
                c="ink.6"
                style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
              >
                Tempo
              </Text>
            </Group>
            <Group gap={6}>
              {DIFFICULTIES.map((d) => (
                <FilterChip
                  key={d.value || 'all-levels'}
                  active={difficulty === d.value}
                  onClick={() => setDifficulty(d.value)}
                  label={d.label}
                />
              ))}
            </Group>
          </Box>
        </Stack>
      </Box>

      {error && (
        <Alert
          color="clay"
          variant="light"
          styles={{
            root: {
              background: 'rgba(193, 87, 63, 0.08)',
              border: '1px solid rgba(193, 87, 63, 0.35)',
              borderRadius: 0,
            },
            title: { color: 'var(--sny-clay-deep)' },
          }}
          title="Something went wrong"
        >
          {error}
        </Alert>
      )}

      {starting && (
        <Alert
          variant="light"
          color="ink"
          styles={{
            root: {
              background: 'var(--sny-paper-highlight)',
              border: '1px solid var(--sny-hairline)',
              borderRadius: 0,
            },
          }}
        >
          <Group gap="sm" wrap="nowrap">
            <Loader size="xs" color="clay.6" />
            <Text fz="sm" c="ink.7">Preparing the scene…</Text>
          </Group>
        </Alert>
      )}

      {/* ── Custom + coach-made scenes ───────────────────────────────────── */}
      {filteredCustom.length > 0 && (
        <Stack gap="md">
          <SectionHeading kicker="Saved in your atelier" title="Custom scenes" />
          <SimpleGrid
            cols={{ base: 1, sm: 2, lg: 3 }}
            spacing="lg"
            className="sny-stagger"
          >
            {filteredCustom.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                onClick={() => handleCustomScenarioClick(s)}
                onDelete={handleDeleteCustom}
              />
            ))}
          </SimpleGrid>
        </Stack>
      )}

      {/* ── Loading / empty / list ──────────────────────────────────────── */}
      {loading ? (
        <Center py={80}>
          <Stack align="center" gap="sm">
            <Loader color="clay.6" size="sm" />
            <Text
              fz="xs"
              c="ink.6"
              style={{ letterSpacing: '0.18em', textTransform: 'uppercase' }}
            >
              Gathering destinations…
            </Text>
          </Stack>
        </Center>
      ) : allEmpty ? (
        <Center py={80}>
          <Stack align="center" gap="sm" maw={420}>
            <Text
              className="sny-serif"
              fz={28}
              c="ink.7"
              ta="center"
              fs="italic"
            >
              Nothing in this corner of the atelier.
            </Text>
            <Text c="ink.6" ta="center" fz="sm" style={{ lineHeight: 1.6 }}>
              Adjust a filter above — or compose a scene of your own.
            </Text>
          </Stack>
        </Center>
      ) : (
        scenarios.length > 0 && (
          <Stack gap="md">
            <SectionHeading
              kicker={filteredCustom.length > 0 ? 'From the atelier' : 'The collection'}
              title={filteredCustom.length > 0 ? 'Featured scenes' : 'Destinations'}
            />
            <SimpleGrid
              cols={{ base: 1, sm: 2, lg: 3 }}
              spacing="lg"
              className="sny-stagger"
            >
              {scenarios.map((s) => (
                <ScenarioCard
                  key={s.id}
                  scenario={s}
                  onClick={handleScenarioClick}
                />
              ))}
            </SimpleGrid>
          </Stack>
        )
      )}
    </Stack>
  );
}

function SectionHeading({ kicker, title }) {
  return (
    <Stack gap={4}>
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
        fz={{ base: 28, sm: 34 }}
        c="ink.8"
        fw={500}
        style={{ lineHeight: 1.1, letterSpacing: '-0.01em' }}
      >
        {title}
      </Text>
    </Stack>
  );
}
