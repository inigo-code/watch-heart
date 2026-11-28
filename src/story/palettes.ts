export type StoryLayout = 'strip' | 'tickets' | 'spotlight';
/** The story palettes; goldclass and midnight are perks, earned with achievements (src/lib/perks.ts). */
export type PaletteKey = 'marquee' | 'velvet' | 'neon' | 'sakura' | 'noir' | 'paper' | 'goldclass' | 'midnight';

export type Palette = {
  label: string;
  /** A light paper (Sakura, Paper): photos behind text are washed out further so dark text reads. */
  light?: boolean;
  /** Background gradient, top to bottom. */
  bg: [string, string, ...string[]];
  text: string;
  muted: string;
  accent: string;
  star: string;
  like: string;
  /** The film strip and ticket stock. */
  strip: string;
  card: string;
};

export const PALETTES: Record<PaletteKey, Palette> = {
  marquee: {
    label: 'Marquee',
    bg: ['#17120A', '#0B0A0D', '#000000'],
    text: '#F7F1E3',
    muted: '#A89D88',
    accent: '#F2B84B',
    star: '#F2B84B',
    like: '#FF4D6D',
    strip: '#000000',
    card: '#1A1610',
  },
  velvet: {
    label: 'Velvet',
    bg: ['#4A0A1A', '#22040C', '#0E0205'],
    text: '#FFF1F2',
    muted: '#D49AA6',
    accent: '#FF4D6D',
    star: '#FFC85C',
    like: '#FF4D6D',
    strip: '#0E0205',
    card: '#2C0812',
  },
  neon: {
    label: 'Neon',
    bg: ['#1A0638', '#0A0320', '#03222A'],
    text: '#F0FBFF',
    muted: '#9AB6D6',
    accent: '#3DE0F0',
    star: '#FF4FD8',
    like: '#FF4FD8',
    strip: '#05010F',
    card: '#160A33',
  },
  sakura: {
    label: 'Sakura',
    light: true,
    bg: ['#FFE3EF', '#FBC6DD', '#E9A3C9'],
    text: '#3A0E26',
    muted: '#6B2A4C',
    accent: '#7E1D52',
    star: '#9A1E5E',
    like: '#E0314B',
    strip: '#3A0E26',
    card: '#FFF2F8',
  },
  noir: {
    label: 'Noir',
    bg: ['#2A2A2A', '#0E0E0E', '#000000'],
    text: '#FFFFFF',
    muted: '#9A9A9A',
    accent: '#FFFFFF',
    star: '#FFFFFF',
    like: '#FFFFFF',
    strip: '#000000',
    card: '#1A1A1A',
  },
  paper: {
    label: 'Paper',
    light: true,
    bg: ['#F6F0E3', '#EDE4D1', '#E3D7BF'],
    text: '#1A1714',
    muted: '#5C5246',
    accent: '#9A1B32',
    star: '#86601A',
    like: '#9A1B32',
    strip: '#1A1714',
    card: '#FBF8F1',
  },
  goldclass: {
    label: 'Gold Class',
    bg: ['#3B2A0C', '#1A1206', '#0A0703'],
    text: '#FFF6E0',
    muted: '#C9B07A',
    accent: '#FFD27A',
    star: '#FFD27A',
    like: '#FF6B81',
    strip: '#0A0703',
    card: '#2A1E09',
  },
  midnight: {
    label: 'Midnight',
    bg: ['#0B1A3A', '#08102A', '#03060F'],
    text: '#EEF3FF',
    muted: '#8FA3CC',
    accent: '#9DB8FF',
    star: '#FFE08A',
    like: '#FF7AA2',
    strip: '#03060F',
    card: '#111F44',
  },
};

/** The background's colour at `at` (0 = top, 1 = bottom), with `alpha`: the stops are spread evenly, as LinearGradient draws them. */
export function bgAt(p: Palette, at: number, alpha = 1): string {
  const stops = p.bg;
  const pos = Math.min(1, Math.max(0, at)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const f = pos - i;
  const rgb = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const [a, b] = [rgb(stops[i]), rgb(stops[i + 1])];
  const mix = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgba(${mix.join(', ')}, ${alpha})`;
}

/**
 * A fade laid over a photo that covers the top `height` (0 to 1) of a story: it starts at `from` opacity, is solid
 * from `solid` (0 to 1 of its own height) on, and follows the background's own colours all the way, so there's no
 * edge across the card. The photo must stop inside the solid part: where the photo and the fade end on the same
 * row, a scaled card half-covers that row with each, and the photo shows through as a thin dark line.
 */
export function photoFade(p: Palette, height: number, from: number, solid = 1): { colors: [string, string, ...string[]]; locations: [number, number, ...number[]] } {
  const steps = 8;
  const colors: string[] = [];
  const locations: number[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const at = t * solid;
    // Eased, so the photo stays clear at the top and goes quietly at the bottom.
    const alpha = from + (1 - from) * t * t * (3 - 2 * t);
    colors.push(bgAt(p, at * height, Math.round(alpha * 1000) / 1000));
    locations.push(at);
  }
  if (solid < 1) {
    colors.push(bgAt(p, height));
    locations.push(1);
  }
  return { colors: colors as [string, string, ...string[]], locations: locations as [number, number, ...number[]] };
}

export const LAYOUTS: { value: StoryLayout; label: string }[] = [
  { value: 'strip', label: 'Film strip' },
  { value: 'tickets', label: 'Tickets' },
  { value: 'spotlight', label: 'Spotlight' },
];
