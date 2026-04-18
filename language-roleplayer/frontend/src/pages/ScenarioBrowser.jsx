import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Center,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import ScenarioCard from '../components/ScenarioCard';
import { getScenarios, createSession } from '../utils/api';
import { getCustomScenarios, deleteCustomScenario } from '../utils/storage';

const LANGUAGES = [
  { value: '', label: 'All languages' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'fr', label: '🇫🇷 French' },
  { value: 'es', label: '🇪🇸 Spanish' },
  { value: 'de', label: '🇩🇪 German' },
  { value: 'ja', label: '🇯🇵 Japanese' },
  { value: 'zh', label: '🇨🇳 Chinese' },
  { value: 'it', label: '🇮🇹 Italian' },
  { value: 'pt', label: '🇧🇷 Portuguese' },
  { value: 'ko', label: '🇰🇷 Korean' },
];

const DIFFICULTIES = [
  { value: '', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

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
    <Stack gap="lg">
      <Stack gap="xs">
        <Title order={2} c="brand.9" style={{ letterSpacing: '-0.02em' }}>
          Choose your scenario
        </Title>
        <Text c="dimmed" maw={560}>
          Immerse yourself in real-world conversations. Pick a scenario and start speaking.
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Select
          label="Language"
          placeholder="Filter"
          data={LANGUAGES}
          value={language}
          onChange={(v) => setLanguage(v ?? '')}
          allowDeselect={false}
        />
        <Select
          label="Level"
          placeholder="Filter"
          data={DIFFICULTIES}
          value={difficulty}
          onChange={(v) => setDifficulty(v ?? '')}
          allowDeselect={false}
        />
      </SimpleGrid>

      {error && (
        <Alert color="red" title="Something went wrong">
          {error}
        </Alert>
      )}

      {starting && (
        <Alert color="blue" variant="light">
          Starting session… please wait.
        </Alert>
      )}

      {filteredCustom.length > 0 && (
        <>
          <Text tt="uppercase" fz="xs" fw={700} c="dimmed" style={{ letterSpacing: '0.08em' }}>
            Your scenarios
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {filteredCustom.map((s) => (
              <ScenarioCard
                key={s.id}
                scenario={s}
                onClick={() => handleCustomScenarioClick(s)}
                onDelete={handleDeleteCustom}
              />
            ))}
          </SimpleGrid>
        </>
      )}

      {loading ? (
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader color="brand" />
            <Text c="dimmed">Loading scenarios…</Text>
          </Stack>
        </Center>
      ) : allEmpty ? (
        <Center py={60}>
          <Stack align="center" gap="sm">
            <Text fz="3rem">🌍</Text>
            <Text c="dimmed" ta="center" maw={400}>
              No scenarios found. Try adjusting your filters or create your own.
            </Text>
          </Stack>
        </Center>
      ) : (
        scenarios.length > 0 && (
          <>
            {filteredCustom.length > 0 && (
              <Text tt="uppercase" fz="xs" fw={700} c="dimmed" style={{ letterSpacing: '0.08em' }}>
                Featured scenarios
              </Text>
            )}
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {scenarios.map((s) => (
                <ScenarioCard
                  key={s.id}
                  scenario={s}
                  onClick={handleScenarioClick}
                />
              ))}
            </SimpleGrid>
          </>
        )
      )}
    </Stack>
  );
}
