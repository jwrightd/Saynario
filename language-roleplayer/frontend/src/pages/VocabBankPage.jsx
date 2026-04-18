import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Center,
  Group,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { getVocabBank, clearVocabForLanguage } from '../utils/storage';

const LANG_NAMES = {
  en: 'English', fr: 'French', es: 'Spanish', de: 'German',
  ja: 'Japanese', zh: 'Chinese', it: 'Italian',
  pt: 'Portuguese', ko: 'Korean',
};

const LANG_CITIES = {
  en: 'London', fr: 'Paris', es: 'Seville', de: 'Berlin',
  ja: 'Kyoto', zh: 'Shanghai', it: 'Rome', pt: 'Lisbon', ko: 'Seoul',
};

const LANG_CODES = {
  en: 'EN', fr: 'FR', es: 'ES', de: 'DE', ja: 'JA',
  zh: 'ZH', it: 'IT', pt: 'PT', ko: 'KO',
};

function typeAccent(type) {
  switch (type) {
    case 'verb': return 'var(--sny-olive)';
    case 'phrase': return 'var(--sny-gilt)';
    case 'adjective': return 'var(--sny-dusk)';
    default: return 'var(--sny-ink)';
  }
}

export default function VocabBankPage() {
  const [bank, setBank] = useState({});
  const [activeLang, setActiveLang] = useState(null);
  const [copied, setCopied] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const b = getVocabBank();
    setBank(b);
    const langs = Object.keys(b);
    if (langs.length > 0) setActiveLang(langs[0]);
  }, []);

  function handleClear(lang) {
    if (!window.confirm(`Clear all ${LANG_NAMES[lang] || lang} vocabulary?`)) return;
    clearVocabForLanguage(lang);
    const b = getVocabBank();
    setBank(b);
    const langs = Object.keys(b);
    setActiveLang(langs.length > 0 ? langs[0] : null);
  }

  async function handleCopy(word) {
    try {
      await navigator.clipboard.writeText(word);
      setCopied(word);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  const languages = Object.keys(bank);
  const activeWords = activeLang ? (bank[activeLang] || []) : [];
  const reversed = [...activeWords].reverse();

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
          · The lexicon
        </Text>
        <Text
          className="sny-serif"
          fz={{ base: 42, sm: 56 }}
          fw={500}
          c="ink.8"
          style={{ letterSpacing: '-0.02em', lineHeight: 1.05 }}
        >
          Words you have gathered.
        </Text>
        <Text mt="md" fz="md" c="ink.6" maw={620} style={{ lineHeight: 1.65 }}>
          Phrases and vocabulary from your conversations, kept by destination.
          Think of this page as the back of a passport — a small library of
          what you now know how to say.
        </Text>
      </Box>

      {languages.length === 0 ? (
        <Center py={80}>
          <Stack align="center" gap="sm" maw={440}>
            <Text
              className="sny-serif"
              fz={30}
              fs="italic"
              c="ink.7"
              ta="center"
              style={{ letterSpacing: '-0.01em' }}
            >
              A blank ledger, for now.
            </Text>
            <Text fz="sm" c="ink.6" ta="center" style={{ lineHeight: 1.6 }}>
              Complete a conversation and your companion will suggest the most
              useful vocabulary. It will be added here, by destination.
            </Text>
            <Button
              mt="sm"
              color="clay.6"
              radius={0}
              onClick={() => navigate('/')}
              styles={{ root: { fontWeight: 600 } }}
            >
              Choose a destination →
            </Button>
          </Stack>
        </Center>
      ) : (
        <Stack gap={24}>
          {/* Ledger tabs — typographic, no pills. */}
          <Box
            style={{
              borderTop: '1px solid var(--sny-hairline)',
              borderBottom: '1px solid var(--sny-hairline)',
              background: 'var(--sny-paper-highlight)',
            }}
          >
            <Group gap={0} wrap="wrap">
              {languages.map((lang) => {
                const active = lang === activeLang;
                return (
                  <UnstyledButton
                    key={lang}
                    onClick={() => setActiveLang(lang)}
                    px="lg"
                    py="md"
                    style={{
                      borderRight: '1px solid var(--sny-hairline)',
                      background: active ? 'var(--sny-paper)' : 'transparent',
                      position: 'relative',
                    }}
                  >
                    <Group gap={8} align="baseline">
                      <Text
                        fz={10}
                        fw={700}
                        c={active ? 'clay.6' : 'ink.6'}
                        style={{ letterSpacing: '0.22em', textTransform: 'uppercase' }}
                      >
                        {LANG_CODES[lang] || lang.toUpperCase()}
                      </Text>
                      <Text
                        className="sny-serif"
                        fz={18}
                        fw={500}
                        c={active ? 'ink.8' : 'ink.6'}
                      >
                        {LANG_NAMES[lang] || lang}
                      </Text>
                      <Text
                        fz="xs"
                        c="ink.5"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {bank[lang].length}
                      </Text>
                    </Group>
                    {active && (
                      <Box
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: -1,
                          height: 2,
                          background: 'var(--sny-clay)',
                        }}
                      />
                    )}
                  </UnstyledButton>
                );
              })}
            </Group>
          </Box>

          {activeLang && (
            <Box>
              <Group justify="space-between" align="baseline" mb="md">
                <Stack gap={2}>
                  <Text
                    fz={10}
                    fw={700}
                    c="clay.6"
                    style={{ letterSpacing: '0.28em', textTransform: 'uppercase' }}
                  >
                    {LANG_CITIES[activeLang] || 'Atelier'} · {LANG_CODES[activeLang] || ''}
                  </Text>
                  <Text
                    className="sny-serif"
                    fz={28}
                    fw={500}
                    c="ink.8"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    {LANG_NAMES[activeLang] || activeLang} · {activeWords.length} {activeWords.length === 1 ? 'entry' : 'entries'}
                  </Text>
                </Stack>
                <Button
                  variant="default"
                  size="xs"
                  radius={0}
                  onClick={() => handleClear(activeLang)}
                  styles={{
                    root: {
                      background: 'transparent',
                      border: '1px solid var(--sny-hairline)',
                      color: 'var(--sny-clay-deep)',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                    },
                  }}
                >
                  Clear this ledger
                </Button>
              </Group>

              {activeWords.length === 0 ? (
                <Text c="ink.6" p="md" fs="italic" className="sny-serif" fz={18}>
                  No words yet for this destination.
                </Text>
              ) : (
                <Box
                  style={{
                    borderTop: '1px solid var(--sny-hairline)',
                    background: 'var(--sny-paper-highlight)',
                  }}
                >
                  {reversed.map((entry, i) => (
                    <Box
                      key={`${entry.word}-${i}`}
                      className="sny-anim-fade-in"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 1.4fr auto auto',
                        columnGap: 16,
                        alignItems: 'baseline',
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--sny-hairline-soft)',
                        animationDelay: `${Math.min(i, 20) * 0.02}s`,
                      }}
                    >
                      <Text
                        fz={10}
                        c="ink.5"
                        style={{ letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums' }}
                      >
                        · {String(activeWords.length - i).padStart(2, '0')}
                      </Text>
                      <Text
                        className="sny-serif"
                        fz={18}
                        fw={500}
                        c="ink.8"
                        style={{ letterSpacing: '-0.005em' }}
                      >
                        {entry.word}
                      </Text>
                      <Text fz="sm" c="ink.7" style={{ lineHeight: 1.45 }}>
                        {entry.translation}
                      </Text>
                      <Group gap={8} align="center">
                        <Box
                          w={6}
                          h={6}
                          style={{
                            background: typeAccent(entry.type),
                            borderRadius: '50%',
                          }}
                        />
                        <Text
                          fz={10}
                          fw={600}
                          c="ink.6"
                          style={{ letterSpacing: '0.16em', textTransform: 'uppercase' }}
                        >
                          {entry.type}
                        </Text>
                      </Group>
                      <Group gap="sm" align="center">
                        <Text fz={10} c="ink.5" style={{ letterSpacing: '0.06em' }}>
                          {entry.seenAt
                            ? new Date(entry.seenAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: '2-digit',
                              })
                            : '—'}
                        </Text>
                        <UnstyledButton
                          onClick={() => handleCopy(entry.word)}
                          px={8}
                          py={3}
                          style={{
                            border: '1px solid var(--sny-hairline)',
                            background: 'var(--sny-paper)',
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: copied === entry.word ? 'var(--sny-olive)' : 'var(--sny-ink-soft)',
                          }}
                        >
                          {copied === entry.word ? 'Copied' : 'Copy'}
                        </UnstyledButton>
                      </Group>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Stack>
      )}
    </Stack>
  );
}
