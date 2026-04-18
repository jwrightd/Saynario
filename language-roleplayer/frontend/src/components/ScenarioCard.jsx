import {
  ActionIcon,
  Box,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { scenarioBannerBackground, scenarioMoodName } from '../utils/scenarioBanner';

const LANG_NAMES = {
  en: 'English', fr: 'French', es: 'Spanish', de: 'German',
  ja: 'Japanese', zh: 'Chinese', it: 'Italian',
  pt: 'Portuguese', ko: 'Korean',
};

const LANG_CITIES = {
  en: 'London',
  fr: 'Paris',
  es: 'Seville',
  de: 'Berlin',
  ja: 'Kyoto',
  zh: 'Shanghai',
  it: 'Rome',
  pt: 'Lisbon',
  ko: 'Seoul',
};

const LANG_CODES = {
  en: 'EN', fr: 'FR', es: 'ES', de: 'DE', ja: 'JA',
  zh: 'ZH', it: 'IT', pt: 'PT', ko: 'KO',
};

const DIFF_META = {
  beginner:    { label: 'Gentle',     marks: 'I',   hint: 'patient pace' },
  intermediate:{ label: 'Measured',   marks: 'II',  hint: 'natural pace' },
  advanced:    { label: 'Immersive',  marks: 'III', hint: 'native pace' },
};

/**
 * Format an npc_role so it reads naturally after "You'll meet …".
 *
 *   "A ramen shop owner"  → "a ramen shop owner"   (lowercase article)
 *   "The concierge"       → "the concierge"
 *   "Barista"             → "a Barista"            (insert article)
 *   "Artist"              → "an Artist"            (vowel → "an")
 *   "Marcel"              → "Marcel"               (proper noun, leave alone)
 *
 * Rule: if the role starts with a recognized leading article (A / An / The),
 * lowercase it. Otherwise prepend "a" or "an" based on the first letter.
 * Proper-noun names (a single capitalized word with no other words, or
 * names detected by a simple heuristic) are left untouched so we don't end
 * up saying "You'll meet a Marcel".
 */
function formatRoleWithArticle(role) {
  if (!role) return role;
  const trimmed = role.trim();
  if (!trimmed) return trimmed;

  // Lowercase a leading article if present.
  const articleMatch = trimmed.match(/^(A|An|The)(\s+)(.+)/);
  if (articleMatch) {
    return articleMatch[1].toLowerCase() + articleMatch[2] + articleMatch[3];
  }

  // Heuristic: a single capitalized word is most likely a proper name.
  // Leave those untouched ("Marcel", not "a Marcel").
  const words = trimmed.split(/\s+/);
  const looksLikeProperName =
    words.length === 1 && /^[A-Z][a-z'’\-]+$/.test(words[0]);
  if (looksLikeProperName) return trimmed;

  // Otherwise pick "a" or "an" from the leading sound (simple vowel check).
  const firstChar = trimmed.charAt(0).toLowerCase();
  const article = 'aeiou'.includes(firstChar) ? 'an' : 'a';
  return `${article} ${trimmed}`;
}

function DestinationMark({ lang }) {
  // Small, typographic destination emblem — no flag emoji.
  const code = LANG_CODES[lang] || '··';
  return (
    <Box
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: 'rgba(251, 247, 240, 0.92)',
        border: '1px solid rgba(31, 39, 72, 0.12)',
        borderRadius: 1,
      }}
    >
      <Box
        w={5}
        h={5}
        style={{ background: 'var(--sny-clay)', borderRadius: '50%' }}
      />
      <Text
        fz={10}
        fw={700}
        c="ink.8"
        style={{ letterSpacing: '0.22em', lineHeight: 1 }}
      >
        {code}
      </Text>
    </Box>
  );
}

export default function ScenarioCard({ scenario, onClick, onDelete }) {
  const lang = scenario.target_language || 'fr';
  const diff = DIFF_META[scenario.difficulty] || DIFF_META.beginner;
  const langName = LANG_NAMES[lang] || lang.toUpperCase();
  const city = LANG_CITIES[lang] || 'Atelier';
  const moodName = scenarioMoodName(lang);
  const bannerBg = scenarioBannerBackground(lang);

  const handleActivate = () => onClick(scenario.id ?? scenario);

  return (
    <Box
      className="sny-postcard"
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Upper banner — a tactile, painterly mood panel. */}
      <Box
        style={{
          position: 'relative',
          height: 152,
          background: bannerBg,
          overflow: 'hidden',
        }}
      >
        {/* Subtle film grain for texture. */}
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='12'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.15 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
            mixBlendMode: 'overlay',
            opacity: 0.6,
            pointerEvents: 'none',
          }}
        />
        {/* Vignette at the top for stamp legibility. */}
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(31, 39, 72, 0.18) 0%, transparent 45%, rgba(31, 39, 72, 0.3) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Corner stamp: city name */}
        <Box
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <DestinationMark lang={lang} />
          <Text
            fz={10}
            fw={700}
            c="rgba(255,255,255,0.95)"
            style={{
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              textShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }}
          >
            {city}
          </Text>
        </Box>

        {scenario.isCustom && (
          <Box
            className="sny-postcard__stamp"
            style={{
              color: 'var(--sny-paper-highlight)',
              borderColor: 'rgba(251, 247, 240, 0.7)',
              background: 'rgba(31, 39, 72, 0.35)',
            }}
          >
            Custom
          </Box>
        )}

        {/* Editorial city label at bottom */}
        <Box
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 12,
            color: 'rgba(255,255,255,0.92)',
          }}
        >
          <Text
            fz={10}
            fw={600}
            style={{
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              opacity: 0.85,
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            {moodName}
          </Text>
        </Box>
      </Box>

      {/* Card body — paper with editorial typography. */}
      <Stack
        gap={10}
        p="lg"
        style={{
          flex: 1,
          background: 'var(--sny-paper-highlight)',
          borderTop: '1px solid var(--sny-hairline)',
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Text
            className="sny-serif"
            fz={22}
            fw={500}
            c="ink.8"
            lineClamp={2}
            style={{ lineHeight: 1.15, letterSpacing: '-0.01em', flex: 1 }}
          >
            {scenario.title}
          </Text>
          {onDelete && (
            <ActionIcon
              variant="subtle"
              color="ink"
              size="sm"
              radius={0}
              aria-label="Delete scenario"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(scenario.id);
              }}
              style={{ color: 'var(--sny-ink-soft)' }}
            >
              ×
            </ActionIcon>
          )}
        </Group>

        <Text fz="sm" c="ink.6" lineClamp={2} style={{ lineHeight: 1.5 }}>
          {scenario.setting}
        </Text>

        {scenario.npc_role && (
          <Text
            fz="sm"
            fs="italic"
            c="ink.7"
            className="sny-serif"
            style={{ fontWeight: 500 }}
          >
            You’ll meet {formatRoleWithArticle(scenario.npc_role)}
          </Text>
        )}

        {scenario.vocabulary_domain?.length > 0 && (
          <Group gap={6} mt={2}>
            {scenario.vocabulary_domain.slice(0, 4).map((v) => (
              <Text
                key={v}
                fz={10}
                fw={600}
                c="ink.6"
                px={6}
                py={3}
                style={{
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  border: '1px solid var(--sny-hairline)',
                  background: 'var(--sny-paper)',
                }}
              >
                {v}
              </Text>
            ))}
          </Group>
        )}

        {/* Footer rule */}
        <Box
          mt={8}
          pt={12}
          style={{ borderTop: '1px solid var(--sny-hairline-soft)' }}
        >
          <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
            <Group gap={10} align="center" wrap="nowrap">
              <Text
                fz={10}
                fw={700}
                c="clay.6"
                style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
              >
                {langName}
              </Text>
              <Box
                w={3}
                h={3}
                style={{ background: 'var(--sny-gilt)', borderRadius: '50%' }}
              />
              <Text
                fz={10}
                fw={600}
                c="ink.6"
                style={{ letterSpacing: '0.16em', textTransform: 'uppercase' }}
                title={diff.hint}
              >
                {diff.label} · {diff.marks}
              </Text>
            </Group>
            <Text fz={10} c="ink.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {scenario.max_turns || 20} turns
            </Text>
          </Group>
        </Box>
      </Stack>
    </Box>
  );
}
