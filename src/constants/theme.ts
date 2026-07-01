/**
 * App theme: colors (light/dark), fonts, spacing, radii.
 * Extended from the Expo template with a warm, fresh "health" palette and
 * per-macro accent colors for the dashboard.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1A1C1A',
    textSecondary: '#5C6660',
    background: '#FBFAF6', // warm off-white
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#ECEFE9',
    card: '#FFFFFF',
    border: '#E7E6DF',
    tint: '#2E7D5B', // fresh green accent
    tintSoft: '#E4F1EA',
    danger: '#C0492F',
    water: '#2F9BD1',
  },
  dark: {
    text: '#F2F3EF',
    textSecondary: '#A2ACA5',
    background: '#12140F',
    backgroundElement: '#1C1F19',
    backgroundSelected: '#2A2E26',
    card: '#1C1F19',
    border: '#2C302A',
    tint: '#6FD3A2',
    tintSoft: '#1E2C24',
    danger: '#E4785F',
    water: '#4FB4E6',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Per-macro accent colors, consistent across light/dark. */
export const MacroColors = {
  calories: '#2E7D5B',
  protein: '#E8663D',
  carbs: '#E0A93B',
  fat: '#6C8AE4',
  fiber: '#4CA36B',
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
