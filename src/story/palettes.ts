export type StoryLayout = 'strip' | 'tickets' | 'spotlight';
export type PaletteKey = 'marquee' | 'velvet' | 'neon' | 'sakura' | 'noir' | 'paper';

export type Palette = {
  label: string;
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
    bg: ['#FFE3EF', '#FBC6DD', '#E9A3C9'],
    text: '#3A0E26',
    muted: '#8C4A6C',
    accent: '#C2417F',
    star: '#C2417F',
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
    bg: ['#F6F0E3', '#EDE4D1', '#E3D7BF'],
    text: '#1A1714',
    muted: '#7A7064',
    accent: '#B3203A',
    star: '#B8862B',
    like: '#B3203A',
    strip: '#1A1714',
    card: '#FBF8F1',
  },
};

export const LAYOUTS: { value: StoryLayout; label: string }[] = [
  { value: 'strip', label: 'Film strip' },
  { value: 'tickets', label: 'Tickets' },
  { value: 'spotlight', label: 'Spotlight' },
];
