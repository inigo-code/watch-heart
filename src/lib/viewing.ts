import type Ionicons from '@expo/vector-icons/Ionicons';

import type { Entry } from '@/store/types';

// The choices for "more about this viewing" on the log form: how it felt, what it was on, and where.

type Icon = keyof typeof Ionicons.glyphMap;

export const MAX_VIBES = 5;

export const VIBES = [
  'Masterpiece',
  'Mind-bending',
  'Comfort watch',
  'Feel-good',
  'Tearjerker',
  'Hilarious',
  'Terrifying',
  'Intense',
  'Slow burn',
  'Stunning',
  'Plot twist',
  'Romantic',
  'Dark',
  'Underrated',
  'Overhyped',
  'Boring',
];

export const DEVICES: { key: string; label: string; phrase: string; icon: Icon }[] = [
  { key: 'cinema', label: 'Cinema', phrase: 'At the cinema', icon: 'film-outline' },
  { key: 'tv', label: 'TV', phrase: 'On TV', icon: 'tv-outline' },
  { key: 'projector', label: 'Projector', phrase: 'On a projector', icon: 'videocam-outline' },
  { key: 'computer', label: 'Computer', phrase: 'On a computer', icon: 'laptop-outline' },
  { key: 'tablet', label: 'Tablet', phrase: 'On a tablet', icon: 'tablet-portrait-outline' },
  { key: 'phone', label: 'Phone', phrase: 'On a phone', icon: 'phone-portrait-outline' },
];

export const CONTEXTS: { key: string; label: string; icon: Icon }[] = [
  { key: 'home', label: 'At home', icon: 'home-outline' },
  { key: 'late', label: 'Late night', icon: 'moon-outline' },
  { key: 'holidays', label: 'Holidays', icon: 'sunny-outline' },
  { key: 'go', label: 'On the go', icon: 'walk-outline' },
  { key: 'flight', label: 'On a flight', icon: 'airplane-outline' },
  { key: 'work', label: 'At work', icon: 'briefcase-outline' },
];

/** Ways to watch that aren't a streaming service. */
export const FORMATS = ['Blu-ray / DVD', 'Download', 'TV channel', 'Other'];

export const deviceLabel = (key?: string | null) => DEVICES.find((d) => d.key === key)?.label ?? null;
export const contextLabel = (key: string) => CONTEXTS.find((c) => c.key === key)?.label ?? key;

/** Whether any of these were filled in, so the section opens to show them. */
export const hasViewingDetails = (e: Pick<Entry, 'vibes' | 'device' | 'context' | 'platform' | 'character'>) =>
  !!(e.vibes?.length || e.device || e.context?.length || e.platform || e.character);

/** "On TV · At home · Netflix", for the entry page. */
export function viewingLine(e: Pick<Entry, 'device' | 'context' | 'platform'>): string {
  return [DEVICES.find((d) => d.key === e.device)?.phrase, ...(e.context ?? []).map(contextLabel), e.platform].filter(Boolean).join(' · ');
}
