import { createTheme, rem } from '@mantine/core';

/** Brand palette (matches legacy CSS variables). */
const brand = [
  '#E8EEF4',
  '#D4E3F0',
  '#A8C8E4',
  '#7BA8D4',
  '#4E88C4',
  '#2E86C1',
  '#2570A8',
  '#1B4F72',
  '#142A42',
  '#0D1B2A',
];

const gold = [
  '#FFF8E6',
  '#FFEFC2',
  '#FFE399',
  '#FFD666',
  '#FFC433',
  '#F0A500',
  '#C88600',
  '#9A6800',
  '#6D4A00',
  '#403000',
];

const teal = [
  '#E6FAF6',
  '#CCF5ED',
  '#99EBDB',
  '#66E0C9',
  '#33D6B7',
  '#1ABC9C',
  '#159A80',
  '#117865',
  '#0C564A',
  '#08342F',
];

export const appTheme = createTheme({
  primaryColor: 'brand',
  colors: {
    brand,
    gold,
    teal,
  },
  defaultRadius: 'md',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  fontFamilyMonospace: 'ui-monospace, monospace',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: '700',
  },
  focusRing: 'auto',
  defaultGradient: { from: 'brand.4', to: 'brand.7', deg: 135 },
  spacing: {
    xs: rem(8),
    sm: rem(12),
    md: rem(16),
    lg: rem(24),
    xl: rem(32),
  },
  breakpoints: {
    xs: '36em',
    sm: '48em',
    md: '62em',
    lg: '75em',
    xl: '88em',
  },
});
