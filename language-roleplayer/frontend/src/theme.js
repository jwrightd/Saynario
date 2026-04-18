import { createTheme, rem } from '@mantine/core';

/**
 * Saynario — Boutique Travel Atelier
 *
 * A warm, editorial palette inspired by paper journals, patinated metal,
 * terracotta rooftops, olive groves, and inked maps. Avoid cold SaaS blue
 * and purple-gradient tech defaults.
 */

// Ivory / paper — the primary surface of the journal.
const paper = [
  '#FBF7F0', // 0  page highlight
  '#F7F1E5', // 1  page
  '#F1E9D6', // 2  soft panel
  '#E9DFC7', // 3  muted panel
  '#DCCFAF', // 4  pressed
  '#C9B98F', // 5  stamp
  '#A99968', // 6  detail
  '#7F724A', // 7  detail-dark
  '#544C32', // 8
  '#2E2A1C', // 9
];

// Ink navy — structural text + deep surfaces.
const ink = [
  '#E4E6EC',
  '#C9CCD8',
  '#9CA2B6',
  '#6E7693',
  '#495177',
  '#2F3860', // 5  hover
  '#1F2748', // 6  standard
  '#171D38', // 7
  '#0F142A', // 8  strong
  '#0A0E1E', // 9  deepest
];

// Terracotta — primary accent, warm clay.
const clay = [
  '#FBEEE7',
  '#F4D7C9',
  '#EBBBA4',
  '#E0987A',
  '#D27A57',
  '#C1573F', // 5  primary accent
  '#A9442E',
  '#8B3523',
  '#6B2818',
  '#461811',
];

// Olive / sage — success + progress, growth.
const olive = [
  '#EEF0E5',
  '#DAE0C6',
  '#C0CAA2',
  '#A4B27D',
  '#89985E',
  '#6E7F46', // 5  primary success
  '#5A6A38',
  '#46532B',
  '#333D1F',
  '#202613',
];

// Muted gold — highlights, streak badges, small details.
const gilt = [
  '#FBF2DC',
  '#F5E2B1',
  '#EDCE84',
  '#E2B758',
  '#D3A03A',
  '#B8862A', // 5  detail accent
  '#976C1F',
  '#745217',
  '#523910',
  '#32220A',
];

// Rose / dusk — soft atmospheric accents.
const dusk = [
  '#F6E6DC',
  '#EDCEBC',
  '#DFB09A',
  '#CE8F77',
  '#B96E55',
  '#9F5238',
  '#833E28',
  '#682F1E',
  '#4D2215',
  '#30160D',
];

export const appTheme = createTheme({
  // Mantine requires at least one primary; we register the full set.
  primaryColor: 'clay',
  primaryShade: { light: 5, dark: 4 },
  colors: {
    paper,
    ink,
    clay,
    olive,
    gilt,
    dusk,
    // Backwards-compatible aliases (some existing props reference these).
    brand: ink,
    gold: gilt,
    teal: olive,
  },
  white: '#FBF7F0',
  black: '#0F142A',
  defaultRadius: 'sm',
  fontFamily:
    '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMonospace:
    '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  headings: {
    fontFamily:
      '"Cormorant Garamond", "Playfair Display", Georgia, "Times New Roman", serif',
    fontWeight: '500',
    sizes: {
      h1: { fontSize: rem(48), lineHeight: '1.1', fontWeight: '500' },
      h2: { fontSize: rem(34), lineHeight: '1.15', fontWeight: '500' },
      h3: { fontSize: rem(26), lineHeight: '1.2', fontWeight: '500' },
      h4: { fontSize: rem(20), lineHeight: '1.3', fontWeight: '600' },
      h5: { fontSize: rem(16), lineHeight: '1.35', fontWeight: '600' },
      h6: { fontSize: rem(14), lineHeight: '1.4', fontWeight: '700' },
    },
  },
  focusRing: 'auto',
  defaultGradient: { from: 'clay.5', to: 'dusk.6', deg: 135 },
  spacing: {
    xs: rem(8),
    sm: rem(12),
    md: rem(16),
    lg: rem(24),
    xl: rem(40),
  },
  radius: {
    xs: rem(2),
    sm: rem(4),
    md: rem(6),
    lg: rem(10),
    xl: rem(16),
  },
  shadows: {
    xs: '0 1px 2px rgba(31, 39, 72, 0.04)',
    sm: '0 1px 2px rgba(31, 39, 72, 0.05), 0 2px 6px rgba(31, 39, 72, 0.04)',
    md: '0 4px 12px rgba(31, 39, 72, 0.08), 0 1px 2px rgba(31, 39, 72, 0.04)',
    lg: '0 12px 28px rgba(31, 39, 72, 0.10), 0 2px 4px rgba(31, 39, 72, 0.05)',
    xl: '0 24px 48px rgba(31, 39, 72, 0.14), 0 4px 8px rgba(31, 39, 72, 0.06)',
  },
  breakpoints: {
    xs: '36em',
    sm: '48em',
    md: '62em',
    lg: '75em',
    xl: '88em',
  },
  other: {
    serif:
      '"Cormorant Garamond", "Playfair Display", Georgia, "Times New Roman", serif',
    sans:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    handwrite:
      '"Caveat", "Kalam", "Segoe Script", cursive',
    paperBg: '#F7F1E5',
    paperBgDeep: '#F1E9D6',
    inkText: '#1F2748',
    inkSoft: '#495177',
    hairline: 'rgba(31, 39, 72, 0.12)',
    hairlineSoft: 'rgba(31, 39, 72, 0.06)',
    clay: '#C1573F',
    olive: '#6E7F46',
    gilt: '#B8862A',
  },
});
