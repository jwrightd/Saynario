import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Text,
} from '@mantine/core';
import { scenarioBannerBackground } from '../utils/scenarioBanner';

const LANG_NAMES = {
  en: 'English', fr: 'French', es: 'Spanish', de: 'German',
  ja: 'Japanese', zh: 'Chinese', it: 'Italian',
  pt: 'Portuguese', ko: 'Korean',
};

const LANG_FLAGS = {
  en: '🇬🇧', fr: '🇫🇷', es: '🇪🇸', de: '🇩🇪', ja: '🇯🇵',
  zh: '🇨🇳', it: '🇮🇹', pt: '🇧🇷', ko: '🇰🇷',
};

const DIFF_LABELS = {
  beginner: { label: 'Beginner', stars: '★☆☆', color: 'teal' },
  intermediate: { label: 'Intermediate', stars: '★★☆', color: 'gold' },
  advanced: { label: 'Advanced', stars: '★★★', color: 'red' },
};

const NPC_AVATARS = {
  en: '🎩',
  fr: '👨‍🍳',
  es: '🧑‍🌾',
  de: '👔',
  ja: '🍜',
  zh: '🏮',
  it: '🎭',
  pt: '🌴',
  ko: '🏯',
};

export default function ScenarioCard({ scenario, onClick, onDelete }) {
  const lang = scenario.target_language || 'fr';
  const diff = DIFF_LABELS[scenario.difficulty] || DIFF_LABELS.beginner;
  const flag = LANG_FLAGS[lang] || '🌐';
  const langName = LANG_NAMES[lang] || lang.toUpperCase();
  const avatar = NPC_AVATARS[lang] || '🧑';
  const bannerBg = scenarioBannerBackground(lang);

  return (
    <Card
      padding={0}
      radius="md"
      withBorder
      shadow="sm"
      role="button"
      tabIndex={0}
      onClick={() => onClick(scenario.id ?? scenario)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(scenario.id ?? scenario);
        }
      }}
      styles={{
        root: {
          cursor: 'pointer',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          overflow: 'hidden',
        },
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = 'var(--mantine-shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)';
      }}
    >
      <Card.Section
        h={72}
        style={{
          background: bannerBg,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '0.5rem 1rem',
          position: 'relative',
        }}
      >
        <Text span fz="1.6rem" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }}>
          {flag}
        </Text>
        <Text span fz="2rem">
          {avatar}
        </Text>
        {scenario.isCustom && (
          <Badge
            size="xs"
            color="gold"
            variant="filled"
            style={{ position: 'absolute', top: 8, right: 8 }}
          >
            Custom
          </Badge>
        )}
      </Card.Section>

      <Card.Section p="md" pt="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs" mb={6}>
          <Text fw={700} fz="sm" lineClamp={2} c="brand.9" style={{ flex: 1 }}>
            {scenario.title}
          </Text>
          <Badge size="sm" color={diff.color} variant="light">
            {diff.stars}
          </Badge>
        </Group>

        <Text fz="sm" c="dimmed" lineClamp={2} mb="sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {scenario.setting}
        </Text>

        <Group justify="space-between" align="center" gap="xs" mb="xs">
          <Text fz="xs" fw={600} c="brand.7">
            {flag} {langName}
          </Text>
          <Text fz="xs" c="dimmed" fs="italic" lineClamp={1} maw="45%">
            {scenario.npc_role}
          </Text>
        </Group>

        {scenario.vocabulary_domain?.length > 0 && (
          <Group gap={6} mb="sm">
            {scenario.vocabulary_domain.slice(0, 4).map((v) => (
              <Badge key={v} size="xs" variant="light" color="gray">
                {v}
              </Badge>
            ))}
          </Group>
        )}

        <Group justify="space-between" align="center">
          <Text fz="xs" c="dimmed">
            Up to {scenario.max_turns || 20} turns
          </Text>
          {onDelete && (
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              aria-label="Delete scenario"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(scenario.id);
              }}
            >
              ✕
            </ActionIcon>
          )}
        </Group>
      </Card.Section>
    </Card>
  );
}
