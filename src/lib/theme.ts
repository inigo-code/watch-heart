import { useColorScheme } from 'react-native';

import { useSettings } from '@/settings/SettingsProvider';
import type { AccentKey } from '@/settings/SettingsProvider';

// Two looks: the projection room (dark, the default) and screenplay paper (light, cream and ink).

const dark = {
  dark: true,
  bg: '#0B0A0D',
  card: '#16141A',
  elevated: '#1E1B23',
  text: '#F4EFE6',
  textMuted: '#8F8898',
  border: '#2A2631',
  accent: '#F2B84B',
  /** The accent on a surface that stays dark in both looks. */
  accentOnDark: '#F2B84B',
  accentText: '#120F08',
  accentSoft: '#33280F',
  chip: '#1E1B23',
  chipActive: '#F4EFE6',
  chipActiveText: '#0B0A0D',
  star: '#F2B84B',
  like: '#FF4D6D',
  danger: '#FF6464',
  toast: '#F4EFE6',
  toastText: '#0B0A0D',
  overlay: 'rgba(0,0,0,0.65)',
  /** Perforations and sprocket holes: cut out of the card, so they show the screen behind. */
  hole: '#0B0A0D',
};

const light: typeof dark = {
  dark: false,
  bg: '#F3EDE1',
  card: '#FBF8F1',
  elevated: '#FFFFFF',
  text: '#1A1714',
  textMuted: '#685F54',
  border: '#E0D6C5',
  accent: '#8C6200',
  accentOnDark: '#F2B84B',
  accentText: '#FFFFFF',
  accentSoft: '#F0E2C2',
  chip: '#E9E1D2',
  chipActive: '#1A1714',
  chipActiveText: '#F3EDE1',
  star: '#C8901E',
  like: '#E0314B',
  danger: '#C93636',
  toast: '#1A1714',
  toastText: '#F3EDE1',
  overlay: 'rgba(20,16,12,0.45)',
  hole: '#F3EDE1',
};

export type Theme = typeof dark;

/** Display face for titles (cinema marquee) and a typewriter face for labels (screenplay). */
export const fonts = {
  display: 'BebasNeue_400Regular',
  mono: 'CourierPrime_400Regular',
  monoBold: 'CourierPrime_700Bold',
} as const;

/** The type scale. Pick the nearest step rather than a new number. */
export const font = {
  caption: 12,
  footnote: 13,
  body: 15,
  headline: 17,
  title: 20,
  title2: 24,
  largeTitle: 30,
  marquee: 44,
} as const;

export const shadow = {
  subtle: '0 1px 3px rgba(0, 0, 0, 0.18)',
  raised: '0 6px 16px rgba(0, 0, 0, 0.32)',
  glow: (color: string) => `0 6px 22px ${color}66`,
} as const;

type AccentSpec = { label: string; note: string; light: [string, string, string]; dark: [string, string, string] };

// [accent, text on accent, soft tint] for each look. Every accent reads at 4.5:1 or better on its look's
// page and cards (the light look's gold, neon and sakura are deeper inks than the dark look's for that).
export const ACCENTS: Record<AccentKey, AccentSpec> = {
  marquee: { label: 'Marquee', note: 'Gold bulbs over the box office', light: ['#8C6200', '#FFFFFF', '#F0E2C2'], dark: ['#F2B84B', '#120F08', '#33280F'] },
  velvet: { label: 'Velvet', note: 'Red seats, red curtain', light: ['#C0243F', '#FFFFFF', '#F3D3D8'], dark: ['#FF4D6D', '#1A0509', '#3A1119'] },
  neon: { label: 'Neon', note: 'Night city, cyberpunk', light: ['#0B7480', '#FFFFFF', '#CDEDF0'], dark: ['#3DE0F0', '#03191C', '#0F2E33'] },
  sakura: { label: 'Sakura', note: 'For the otaku', light: ['#B0386F', '#FFFFFF', '#F6D7E6'], dark: ['#FF8FC7', '#22091A', '#3B1530'] },
  noir: { label: 'Noir', note: 'Black and white classics', light: ['#2A2622', '#FFFFFF', '#E1DBD0'], dark: ['#E8E4DC', '#0B0A0D', '#2A2830'] },
  // Perks, earned with achievement points.
  emerald: { label: 'Emerald', note: 'A perk: the jade of an old cinema’s seats', light: ['#0A7A4C', '#FFFFFF', '#D2EDDF'], dark: ['#3DDC97', '#04140D', '#0F2E22'] },
  platinum: { label: 'Platinum', note: 'A perk: for the true cinephile', light: ['#4D5966', '#FFFFFF', '#DCE2E8'], dark: ['#CFD8E3', '#0B0A0D', '#25292F'] },
};

export function buildTheme(isDark: boolean, accent: AccentKey): Theme {
  const base = isDark ? dark : light;
  const [a, aText, aSoft] = ACCENTS[accent][isDark ? 'dark' : 'light'];
  // Surfaces that stay dark in both looks (the Diary's film strip, the About card) take the bright accent.
  return { ...base, accent: a, accentText: aText, accentSoft: aSoft, accentOnDark: ACCENTS[accent].dark[0] };
}

export function useTheme(): Theme {
  const system = useColorScheme();
  const { settings } = useSettings();
  const isDark = settings.themeMode === 'system' ? system !== 'light' : settings.themeMode === 'dark';
  return buildTheme(isDark, settings.accent);
}

/** Colours for each kind of title, used on badges and stats. */
export const KIND_COLORS = {
  movie: '#F2B84B',
  tv: '#3DE0F0',
  anime: '#FF8FC7',
} as const;

/** Darker inks for the same kinds, readable on screenplay paper. */
const KIND_INK = { movie: '#87600F', tv: '#0B7A86', anime: '#B8306F' } as const;

export const kindColor = (kind: keyof typeof KIND_COLORS, theme: Theme) => (theme.dark ? KIND_COLORS : KIND_INK)[kind];
