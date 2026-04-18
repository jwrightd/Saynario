import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Grid,
  Group,
  Loader,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { saveCustomScenario } from '../utils/storage';
import { createSession } from '../utils/api';
import { scenarioBannerBackground, scenarioMoodName } from '../utils/scenarioBanner';

const LANGUAGES = [
  { value: 'en', label: 'English',    city: 'London' },
  { value: 'fr', label: 'French',     city: 'Paris' },
  { value: 'es', label: 'Spanish',    city: 'Seville' },
  { value: 'de', label: 'German',     city: 'Berlin' },
  { value: 'ja', label: 'Japanese',   city: 'Kyoto' },
  { value: 'zh', label: 'Chinese',    city: 'Shanghai' },
  { value: 'it', label: 'Italian',    city: 'Rome' },
  { value: 'pt', label: 'Portuguese', city: 'Lisbon' },
  { value: 'ko', label: 'Korean',     city: 'Seoul' },
];

const DIFFICULTIES = [
  { value: 'beginner',     label: 'Gentle',    marks: 'I',   desc: 'Patient pace, simple structures.' },
  { value: 'intermediate', label: 'Measured',  marks: 'II',  desc: 'Natural pace, idiomatic phrasing.' },
  { value: 'advanced',     label: 'Immersive', marks: 'III', desc: 'Native pace, colloquial depth.' },
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

/**
 * Format an npc_role so it reads naturally after "You'll meet …".
 *   "A ramen shop owner" → "a ramen shop owner"
 *   "Barista"            → "a Barista"
 *   "Artist"             → "an Artist"
 *   "Marcel"             → "Marcel" (proper noun)
 */
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

const FIELD_STYLES = {
  input: {
    background: 'var(--sny-paper-highlight)',
    border: '1px solid var(--sny-hairline)',
    borderRadius: 0,
    fontSize: 15,
    color: 'var(--sny-ink)',
    padding: '10px 12px',
    minHeight: 42,
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: 'var(--sny-ink-soft)',
    marginBottom: 6,
  },
};

function SectionLabel({ children, mt }) {
  return (
    <Text
      fz={10}
      fw={700}
      c="ink.6"
      mb={8}
      mt={mt}
      style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
    >
      {children}
    </Text>
  );
}

export default function CreateScenarioPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const selectedLang = LANGUAGES.find((l) => l.value === form.target_language);
  const bannerBg = scenarioBannerBackground(form.target_language);
  const moodName = scenarioMoodName(form.target_language);
  const diffMeta = DIFFICULTIES.find((d) => d.value === form.difficulty);

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSaveAndPlay() {
    if (!form.title.trim()) { setError('Please give your scene a title.'); return; }
    if (!form.setting.trim()) { setError('Please describe the setting.'); return; }
    if (!form.npc_role.trim()) { setError('Please describe who you will meet.'); return; }
    if (!form.opening_line.trim()) { setError('Please provide an opening line.'); return; }
    setError(null);
    setSaving(true);

    try {
      const saved = saveCustomScenario(form);
      if (!saved) throw new Error('Could not save scenario — storage may be full.');
      const session = await createSession(null, saved);
      navigate(`/conversation/${session.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  function handleSaveOnly() {
    if (!form.title.trim()) { setError('Please give your scene a title.'); return; }
    if (!form.setting.trim()) { setError('Please describe the setting.'); return; }
    if (!form.npc_role.trim()) { setError('Please describe who you will meet.'); return; }
    setError(null);
    saveCustomScenario(form);
    navigate('/');
  }

  return (
    <Stack gap={40} className="sny-anim-fade-soft">
      <Box>
        <UnstyledButton
          onClick={() => navigate('/')}
          mb="md"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sny-ink-soft)',
            padding: '6px 10px',
            border: '1px solid var(--sny-hairline)',
            background: 'var(--sny-paper-highlight)',
          }}
        >
          ← Back to the atelier
        </UnstyledButton>

        <Text
          fz={10}
          fw={700}
          c="clay.6"
          mb={8}
          style={{ letterSpacing: '0.3em', textTransform: 'uppercase' }}
        >
          · Compose a scene
        </Text>
        <Text
          className="sny-serif"
          fz={{ base: 42, sm: 56 }}
          fw={500}
          c="ink.8"
          style={{ letterSpacing: '-0.02em', lineHeight: 1.05, maxWidth: 820 }}
        >
          Direct your own conversation.
        </Text>
        <Text mt="md" fz="md" c="ink.6" maw={620} style={{ lineHeight: 1.65 }}>
          Sketch a destination, set the stage, introduce a character, and give
          them an opening line. Your scenes are kept locally in this journal.
        </Text>
      </Box>

      <Grid gutter={32}>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap={28}>
            {error && (
              <Alert
                color="clay"
                variant="light"
                radius={0}
                styles={{
                  root: {
                    background: 'rgba(193, 87, 63, 0.08)',
                    border: '1px solid rgba(193, 87, 63, 0.35)',
                  },
                  title: { color: 'var(--sny-clay-deep)' },
                }}
                title="Check the form"
              >
                {error}
              </Alert>
            )}

            <Box>
              <SectionLabel>Destination</SectionLabel>
              <Group gap={6}>
                {LANGUAGES.map((l) => {
                  const active = form.target_language === l.value;
                  return (
                    <UnstyledButton
                      key={l.value}
                      onClick={() => handleChange('target_language', l.value)}
                      px={12}
                      py={8}
                      style={{
                        border: active
                          ? '1px solid var(--sny-clay)'
                          : '1px solid var(--sny-hairline)',
                        background: active
                          ? 'rgba(193, 87, 63, 0.1)'
                          : 'var(--sny-paper-highlight)',
                        color: active ? 'var(--sny-clay-deep)' : 'var(--sny-ink)',
                        transition: 'all 0.15s ease',
                        display: 'inline-flex',
                        alignItems: 'baseline',
                        gap: 6,
                      }}
                    >
                      <Text fz={12} fw={600}>{l.label}</Text>
                      <Text
                        fz={10}
                        c={active ? 'clay.6' : 'ink.5'}
                        style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}
                      >
                        {l.city}
                      </Text>
                    </UnstyledButton>
                  );
                })}
              </Group>
            </Box>

            <Box>
              <SectionLabel>Tempo</SectionLabel>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={10}>
                {DIFFICULTIES.map((d) => {
                  const active = form.difficulty === d.value;
                  return (
                    <UnstyledButton
                      key={d.value}
                      onClick={() => handleChange('difficulty', d.value)}
                      p="md"
                      style={{
                        border: active
                          ? '1px solid var(--sny-clay)'
                          : '1px solid var(--sny-hairline)',
                        background: active
                          ? 'rgba(193, 87, 63, 0.06)'
                          : 'var(--sny-paper-highlight)',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Group gap={8} align="baseline" mb={6}>
                        <Text
                          fz={10}
                          fw={700}
                          c={active ? 'clay.6' : 'ink.6'}
                          style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
                        >
                          {d.marks}
                        </Text>
                        <Text
                          className="sny-serif"
                          fz={22}
                          fw={500}
                          c={active ? 'clay.7' : 'ink.8'}
                          style={{ lineHeight: 1, letterSpacing: '-0.01em' }}
                        >
                          {d.label}
                        </Text>
                      </Group>
                      <Text fz="xs" c="ink.6" style={{ lineHeight: 1.45 }}>
                        {d.desc}
                      </Text>
                    </UnstyledButton>
                  );
                })}
              </SimpleGrid>
            </Box>

            <TextInput
              label="Scene title"
              placeholder="e.g., Ordering at a Tokyo ramen shop"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              maxLength={80}
              radius={0}
              styles={FIELD_STYLES}
            />

            <TextInput
              label="Setting & location"
              placeholder="e.g., A narrow ramen counter in Shinjuku, steam and neon"
              value={form.setting}
              onChange={(e) => handleChange('setting', e.target.value)}
              maxLength={120}
              radius={0}
              styles={FIELD_STYLES}
            />

            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Who you meet"
                  placeholder="e.g., a ramen shop owner"
                  value={form.npc_role}
                  onChange={(e) => handleChange('npc_role', e.target.value)}
                  maxLength={60}
                  radius={0}
                  styles={FIELD_STYLES}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Their temperament"
                  placeholder="e.g., gruff, but warm-hearted"
                  value={form.npc_personality}
                  onChange={(e) => handleChange('npc_personality', e.target.value)}
                  maxLength={100}
                  radius={0}
                  styles={FIELD_STYLES}
                />
              </Grid.Col>
            </Grid>

            <Textarea
              label="Opening line"
              description="The first thing your companion says — in the target language."
              placeholder="e.g., Irasshaimase! Nan mei-sama desu ka?"
              value={form.opening_line}
              onChange={(e) => handleChange('opening_line', e.target.value)}
              rows={3}
              maxLength={200}
              radius={0}
              styles={{
                ...FIELD_STYLES,
                description: { color: 'var(--sny-ink-soft)', fontSize: 12, marginBottom: 4 },
                input: {
                  ...FIELD_STYLES.input,
                  fontFamily: 'var(--sny-serif)',
                  fontStyle: 'italic',
                  minHeight: 84,
                },
              }}
            />

            <TextInput
              label="Goal (optional)"
              description="What success looks like — a quiet objective for the scene."
              placeholder="e.g., Order a meal and pay the bill"
              value={form.success_criteria}
              onChange={(e) => handleChange('success_criteria', e.target.value)}
              maxLength={150}
              radius={0}
              styles={{
                ...FIELD_STYLES,
                description: { color: 'var(--sny-ink-soft)', fontSize: 12, marginBottom: 4 },
              }}
            />

            <Box>
              <Group justify="space-between" align="baseline" mb={10}>
                <SectionLabel>Length</SectionLabel>
                <Group gap={6} align="baseline">
                  <Text
                    className="sny-serif"
                    fz={28}
                    fw={500}
                    c="ink.8"
                    style={{ lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {form.max_turns}
                  </Text>
                  <Text fz="xs" c="ink.6" style={{ letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                    turns
                  </Text>
                </Group>
              </Group>
              <Slider
                min={5}
                max={40}
                step={5}
                value={form.max_turns}
                onChange={(v) => handleChange('max_turns', v)}
                color="clay.6"
                size="sm"
                radius={0}
                marks={[
                  { value: 5,  label: 'Brief' },
                  { value: 20, label: 'Standard' },
                  { value: 40, label: 'Extended' },
                ]}
                styles={{
                  track: { background: 'var(--sny-paper-deep)' },
                  bar: { background: 'var(--sny-clay)' },
                  thumb: {
                    background: 'var(--sny-ink)',
                    borderColor: 'var(--sny-ink)',
                    width: 16,
                    height: 16,
                  },
                  markLabel: {
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--sny-ink-soft)',
                  },
                }}
              />
            </Box>

            <Group justify="flex-end" mt={8} gap="sm">
              <Button
                variant="default"
                radius={0}
                onClick={handleSaveOnly}
                disabled={saving}
                styles={{
                  root: {
                    background: 'var(--sny-paper-highlight)',
                    border: '1px solid var(--sny-hairline)',
                    color: 'var(--sny-ink)',
                    fontWeight: 600,
                  },
                }}
              >
                Save for later
              </Button>
              <Button
                onClick={handleSaveAndPlay}
                loading={saving}
                disabled={saving}
                color="clay.6"
                radius={0}
                styles={{
                  root: { fontWeight: 600, letterSpacing: '0.03em' },
                }}
              >
                Step into the scene →
              </Button>
            </Group>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Box style={{ position: 'sticky', top: 96 }}>
            <Text
              fz={10}
              fw={700}
              c="clay.6"
              mb={12}
              style={{ letterSpacing: '0.28em', textTransform: 'uppercase' }}
            >
              · Preview
            </Text>
            <Box
              style={{
                background: 'var(--sny-paper-highlight)',
                border: '1px solid var(--sny-hairline)',
                overflow: 'hidden',
              }}
            >
              <Box
                style={{
                  height: 160,
                  background: bannerBg,
                  position: 'relative',
                }}
              >
                <Box
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage:
                      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.15 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
                    mixBlendMode: 'overlay',
                    opacity: 0.55,
                    pointerEvents: 'none',
                  }}
                />
                <Box
                  style={{
                    position: 'absolute',
                    left: 16,
                    bottom: 12,
                    color: 'rgba(255,255,255,0.95)',
                  }}
                >
                  <Text
                    fz={10}
                    fw={700}
                    style={{
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    }}
                  >
                    {selectedLang?.city} · {moodName}
                  </Text>
                </Box>
              </Box>
              <Stack p="lg" gap={10}>
                <Text
                  className="sny-serif"
                  fz={22}
                  fw={500}
                  c="ink.8"
                  style={{ lineHeight: 1.15, letterSpacing: '-0.01em' }}
                >
                  {form.title || 'Untitled scene'}
                </Text>
                <Text fz="sm" c="ink.6" style={{ lineHeight: 1.5 }}>
                  {form.setting || 'The setting will appear here as you write.'}
                </Text>
                {form.npc_role && (
                  <Text fz="sm" fs="italic" c="ink.7" className="sny-serif">
                    You’ll meet {formatRoleWithArticle(form.npc_role)}
                  </Text>
                )}
                <Group justify="space-between" align="center" mt={6} pt={10} style={{ borderTop: '1px solid var(--sny-hairline-soft)' }}>
                  <Text
                    fz={10}
                    fw={700}
                    c="clay.6"
                    style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
                  >
                    {selectedLang?.label} · {diffMeta?.marks} {diffMeta?.label}
                  </Text>
                  <Text fz={10} c="ink.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {form.max_turns} turns
                  </Text>
                </Group>
              </Stack>

              {form.opening_line && (
                <Box
                  px="lg"
                  py="md"
                  style={{
                    borderTop: '1px solid var(--sny-hairline)',
                    background: 'var(--sny-paper)',
                  }}
                >
                  <Text
                    fz={10}
                    fw={700}
                    c="ink.6"
                    style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
                  >
                    Opening
                  </Text>
                  <Text
                    className="sny-serif"
                    fz={16}
                    fs="italic"
                    c="ink.7"
                    mt={6}
                    style={{ lineHeight: 1.5 }}
                  >
                    “{form.opening_line}”
                  </Text>
                </Box>
              )}

              {saving && (
                <Box px="lg" py="sm" style={{ borderTop: '1px solid var(--sny-hairline)' }}>
                  <Group gap="xs">
                    <Loader size="xs" color="clay.6" />
                    <Text fz="xs" c="ink.6">Preparing the scene…</Text>
                  </Group>
                </Box>
              )}
            </Box>
          </Box>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
