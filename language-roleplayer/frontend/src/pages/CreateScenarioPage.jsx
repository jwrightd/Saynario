import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { saveCustomScenario } from '../utils/storage';
import { createSession } from '../utils/api';
import { scenarioBannerBackground } from '../utils/scenarioBanner';

const LANGUAGES = [
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
  {
    value: 'beginner',
    label: 'Beginner',
    desc: 'Simple vocabulary, short sentences, patient NPC',
    stars: '★☆☆',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    desc: 'Moderate vocabulary, idioms, natural pace',
    stars: '★★☆',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    desc: 'Native-level speech, colloquialisms, complex grammar',
    stars: '★★★',
  },
];

const DEFAULT_FORM = {
  title: '',
  target_language: 'en',
  difficulty: 'beginner',
  setting: '',
  npc_role: '',
  npc_personality: 'friendly and patient',
  opening_line: '',
  success_criteria: 'Have a natural conversation',
  max_turns: 20,
};

export default function CreateScenarioPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const selectedLang = LANGUAGES.find((l) => l.value === form.target_language);
  const bannerBg = scenarioBannerBackground(form.target_language);

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSaveAndPlay() {
    if (!form.title.trim()) { setError('Please enter a scenario title.'); return; }
    if (!form.setting.trim()) { setError('Please describe the setting.'); return; }
    if (!form.npc_role.trim()) { setError('Please enter an NPC role.'); return; }
    if (!form.opening_line.trim()) { setError('Please provide an opening line for the NPC.'); return; }
    setError(null);
    setSaving(true);

    try {
      const saved = saveCustomScenario(form);
      if (!saved) throw new Error('Failed to save scenario — storage may be full.');
      const session = await createSession(null, saved);
      navigate(`/conversation/${session.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  function handleSaveOnly() {
    if (!form.title.trim()) { setError('Please enter a scenario title.'); return; }
    if (!form.setting.trim()) { setError('Please describe the setting.'); return; }
    if (!form.npc_role.trim()) { setError('Please enter an NPC role.'); return; }
    setError(null);
    saveCustomScenario(form);
    navigate('/');
  }

  const diffMeta = DIFFICULTIES.find((d) => d.value === form.difficulty);

  return (
    <Stack gap="xl">
      <div>
        <Button variant="default" size="sm" mb="md" onClick={() => navigate('/')}>
          ← Back
        </Button>
        <Title order={2} c="brand.9">
          Create a scenario
        </Title>
        <Text c="dimmed" mt="xs" maw={560}>
          Design your own immersive language roleplay. Your scenarios are saved locally.
        </Text>
      </div>

      <Grid gutter="xl">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="lg">
            {error && (
              <Alert color="red" title="Check your form">
                {error}
              </Alert>
            )}

            <div>
              <Text fw={600} size="sm" mb="xs">
                Target language
              </Text>
              <Group gap="xs">
                {LANGUAGES.map((l) => (
                  <UnstyledButton
                    key={l.value}
                    onClick={() => handleChange('target_language', l.value)}
                    px="sm"
                    py={6}
                    fz="sm"
                    style={{
                      borderRadius: 20,
                      border: `1.5px solid ${form.target_language === l.value ? 'var(--mantine-color-brand-filled)' : 'var(--mantine-color-gray-3)'}`,
                      background: form.target_language === l.value ? 'var(--mantine-color-brand-filled)' : 'var(--mantine-color-body)',
                      color: form.target_language === l.value ? 'white' : 'inherit',
                      fontWeight: form.target_language === l.value ? 600 : 400,
                    }}
                  >
                    {l.label}
                  </UnstyledButton>
                ))}
              </Group>
            </div>

            <div>
              <Text fw={600} size="sm" mb="xs">
                Difficulty
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                {DIFFICULTIES.map((d) => (
                  <UnstyledButton
                    key={d.value}
                    onClick={() => handleChange('difficulty', d.value)}
                    p="md"
                    style={{
                      borderRadius: 8,
                      border: `1.5px solid ${form.difficulty === d.value ? 'var(--mantine-color-brand-filled)' : 'var(--mantine-color-gray-3)'}`,
                      background: form.difficulty === d.value ? 'var(--mantine-color-brand-filled)' : 'var(--mantine-color-body)',
                      color: form.difficulty === d.value ? 'white' : 'inherit',
                      textAlign: 'center',
                    }}
                  >
                    <Text fz="sm">{d.stars}</Text>
                    <Text fw={600} fz="sm" mt={4}>
                      {d.label}
                    </Text>
                    <Text fz="xs" opacity={0.85} mt={4} lineClamp={2}>
                      {d.desc}
                    </Text>
                  </UnstyledButton>
                ))}
              </SimpleGrid>
            </div>

            <TextInput
              label="Scenario title"
              placeholder="e.g., Ordering at a Tokyo Ramen Shop"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              maxLength={80}
            />

            <TextInput
              label="Setting / location"
              placeholder="e.g., A busy ramen restaurant in Shinjuku, Tokyo"
              value={form.setting}
              onChange={(e) => handleChange('setting', e.target.value)}
              maxLength={120}
            />

            <TextInput
              label="NPC role"
              placeholder="e.g., ramen shop owner, hotel receptionist"
              value={form.npc_role}
              onChange={(e) => handleChange('npc_role', e.target.value)}
              maxLength={60}
            />

            <TextInput
              label="NPC personality"
              placeholder="e.g., gruff but warm-hearted"
              value={form.npc_personality}
              onChange={(e) => handleChange('npc_personality', e.target.value)}
              maxLength={100}
            />

            <Textarea
              label={
                <Text span inherit>
                  Opening line{' '}
                  <Text span fz="sm" fw={400} c="dimmed">
                    (what the NPC says first, in the target language)
                  </Text>
                </Text>
              }
              placeholder="e.g., Irasshaimase! Nan mei-sama desu ka?"
              value={form.opening_line}
              onChange={(e) => handleChange('opening_line', e.target.value)}
              rows={3}
              maxLength={200}
            />

            <TextInput
              label={
                <Text span inherit>
                  Goal / success criteria{' '}
                  <Text span fz="sm" fw={400} c="dimmed">
                    (optional)
                  </Text>
                </Text>
              }
              placeholder="e.g., Successfully order a meal and pay the bill"
              value={form.success_criteria}
              onChange={(e) => handleChange('success_criteria', e.target.value)}
              maxLength={150}
            />

            <div>
              <Text fw={600} size="sm" mb="xs">
                Max turns: <Text span c="brand.7">{form.max_turns}</Text>
              </Text>
              <Slider
                min={5}
                max={40}
                step={5}
                value={form.max_turns}
                onChange={(v) => handleChange('max_turns', v)}
                color="brand"
                marks={[
                  { value: 5, label: '5' },
                  { value: 20, label: '20' },
                  { value: 40, label: '40' },
                ]}
              />
              <Group justify="space-between" mt={6}>
                <Text fz="xs" c="dimmed">Quick</Text>
                <Text fz="xs" c="dimmed">Standard</Text>
                <Text fz="xs" c="dimmed">Extended</Text>
              </Group>
            </div>

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={handleSaveOnly} disabled={saving}>
                Save for later
              </Button>
              <Button onClick={handleSaveAndPlay} loading={saving} disabled={saving}>
                Save & play
              </Button>
            </Group>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Box style={{ position: 'sticky', top: 88 }}>
            <Text tt="uppercase" fz="xs" fw={700} c="dimmed" mb="sm" style={{ letterSpacing: '0.07em' }}>
              Preview
            </Text>
            <Paper radius="md" shadow="md" withBorder overflow="hidden">
              <Box
                h={60}
                pl="md"
                style={{
                  background: bannerBg,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Text fz="2rem">{selectedLang?.label.split(' ')[0]}</Text>
              </Box>
              <Stack p="md" gap="xs">
                <Text fw={700}>{form.title || 'Your scenario'}</Text>
                <Text fz="sm" c="dimmed">
                  {form.setting || 'Setting goes here…'}
                </Text>
                <Group justify="space-between">
                  <Text fz="sm">{selectedLang?.label}</Text>
                  <Text fz="sm" c="brand.7" fw={600}>
                    {diffMeta?.stars}
                  </Text>
                </Group>
              </Stack>
              {form.opening_line ? (
                <Group p="md" pt={0} gap="md" align="flex-start" bg="gray.0" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                  <Text fz="lg">🗣️</Text>
                  <Text fz="sm" c="dimmed" fs="italic" style={{ flex: 1 }}>
                    &ldquo;{form.opening_line}&rdquo;
                  </Text>
                </Group>
              ) : null}
            </Paper>
          </Box>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
