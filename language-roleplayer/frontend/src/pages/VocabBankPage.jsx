import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Center,
  Group,
  Paper,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { getVocabBank, clearVocabForLanguage } from '../utils/storage';

const LANG_NAMES = {
  en: 'English', fr: 'French', es: 'Spanish', de: 'German',
  ja: 'Japanese', zh: 'Chinese', it: 'Italian',
  pt: 'Portuguese', ko: 'Korean',
};

const LANG_FLAGS = {
  en: '🇬🇧', fr: '🇫🇷', es: '🇪🇸', de: '🇩🇪', ja: '🇯🇵',
  zh: '🇨🇳', it: '🇮🇹', pt: '🇧🇷', ko: '🇰🇷',
};

function typeBadgeColor(type) {
  switch (type) {
    case 'verb': return 'teal';
    case 'phrase': return 'gold';
    case 'adjective': return 'violet';
    default: return 'blue';
  }
}

export default function VocabBankPage() {
  const [bank, setBank] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [copied, setCopied] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const b = getVocabBank();
    setBank(b);
    const langs = Object.keys(b);
    if (langs.length > 0) setActiveTab(langs[0]);
  }, []);

  function handleClear(lang) {
    if (!window.confirm(`Clear all ${LANG_NAMES[lang] || lang} vocabulary?`)) return;
    clearVocabForLanguage(lang);
    const b = getVocabBank();
    setBank(b);
    const langs = Object.keys(b);
    setActiveTab(langs.length > 0 ? langs[0] : null);
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
  const activeWords = activeTab ? (bank[activeTab] || []) : [];

  return (
    <Stack gap="lg">
      <div>
        <Button variant="default" size="sm" mb="md" onClick={() => navigate('/')}>
          ← Back
        </Button>
        <Title order={2} c="brand.9">
          Vocabulary bank
        </Title>
        <Text c="dimmed" mt="xs" maw={560}>
          Words and phrases collected from your conversations, organized by language.
        </Text>
      </div>

      {languages.length === 0 ? (
        <Center py={60}>
          <Stack align="center" gap="md">
            <Text fz="3rem">📚</Text>
            <Text c="dimmed" ta="center">
              Your vocabulary bank is empty.
            </Text>
            <Text fz="sm" c="dimmed" ta="center" maw={400}>
              Complete conversations to collect vocabulary automatically.
            </Text>
            <Button onClick={() => navigate('/')}>Start a conversation</Button>
          </Stack>
        </Center>
      ) : (
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="md" style={{ flexWrap: 'wrap' }}>
            {languages.map((lang) => (
              <Tabs.Tab
                key={lang}
                value={lang}
                rightSection={
                  <Badge size="xs" variant="light" circle>
                    {bank[lang].length}
                  </Badge>
                }
              >
                {LANG_FLAGS[lang] || '🌐'} {LANG_NAMES[lang] || lang}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {activeTab && (
            <Paper radius="md" withBorder shadow="sm" overflow="hidden">
              <Group justify="space-between" p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                <Title order={4}>
                  {LANG_FLAGS[activeTab]} {LANG_NAMES[activeTab] || activeTab} — {activeWords.length} words
                </Title>
                <Button color="red" variant="light" size="sm" onClick={() => handleClear(activeTab)}>
                  Clear all
                </Button>
              </Group>

              {activeWords.length === 0 ? (
                <Text c="dimmed" p="md">
                  No words yet for this language.
                </Text>
              ) : (
                <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Word / phrase</Table.Th>
                      <Table.Th>Translation</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Added</Table.Th>
                      <Table.Th w={80} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {[...activeWords].reverse().map((entry, i) => (
                      <Table.Tr key={`${entry.word}-${i}`}>
                        <Table.Td>
                          <Text fw={600} ff="'DM Sans', sans-serif" c="brand.7">
                            {entry.word}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text c="dimmed" fz="sm">{entry.translation}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light" color={typeBadgeColor(entry.type)}>
                            {entry.type}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="sm" c="dimmed">
                            {entry.seenAt
                              ? new Date(entry.seenAt).toLocaleDateString()
                              : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            variant="default"
                            size="compact-xs"
                            onClick={() => handleCopy(entry.word)}
                          >
                            {copied === entry.word ? '✓' : '📋'}
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          )}
        </Tabs>
      )}
    </Stack>
  );
}
