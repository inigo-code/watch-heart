import type { Entry, MediaKind } from '@/store/types';

// "Watched with": the people you watched something with, as plain names in your own diary. They aren't
// accounts and nobody is told; a name is matched case-insensitively ("sam" and "Sam" are one person).

/** A name as typed, tidied: trimmed, single spaces, at most 30 characters. */
export const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, 30);

const key = (name: string) => cleanName(name).toLowerCase();

/** Adds a name unless it's already there (in any case). */
export function withName(names: string[], name: string): string[] {
  const n = cleanName(name);
  if (!n || names.some((x) => key(x) === key(n))) return names;
  return [...names, n];
}

export type Buddy = { name: string; count: number; kinds: Record<MediaKind, number>; lastOn: string; topGenre: string | null };

/** Everyone you've watched with, most viewings first; each spelled as you last wrote it. */
export function buddies(entries: Entry[]): Buddy[] {
  const byKey = new Map<string, Buddy & { genres: Map<string, number> }>();
  for (const e of entries) {
    for (const raw of e.companions ?? []) {
      const k = key(raw);
      if (!k) continue;
      const b = byKey.get(k) ?? { name: cleanName(raw), count: 0, kinds: { movie: 0, tv: 0, anime: 0 }, lastOn: '', topGenre: null, genres: new Map() };
      b.count++;
      b.kinds[e.kind]++;
      if (e.watchedOn >= b.lastOn) {
        b.lastOn = e.watchedOn;
        b.name = cleanName(raw);
      }
      for (const g of e.genres) b.genres.set(g, (b.genres.get(g) ?? 0) + 1);
      byKey.set(k, b);
    }
  }
  return [...byKey.values()]
    .map(({ genres, ...b }) => ({ ...b, topGenre: [...genres.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null }))
    .sort((a, b) => b.count - a.count || b.lastOn.localeCompare(a.lastOn));
}

/** "Sam", "Sam & Priya", "Sam, Priya & 2 more". */
export function namesLine(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]}`;
  return `${names[0]}, ${names[1]} & ${names.length - 2} more`;
}

const NUMBERS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];

/** The ticket stub: "ADMIT ONE" alone, "ADMIT THREE" with two friends. */
export const admit = (companions: number) => `ADMIT ${NUMBERS[companions] ?? String(companions + 1)}`;
