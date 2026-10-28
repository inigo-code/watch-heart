import type { ShowInfo } from '@/api/episodes';
import type { Track, WatchItem } from '@/store/types';

// The rules of the episode tracker. Pure, so they're easy to check.

export const epKey = (season: number, number: number) => `s${season}e${number}`;
export const parseKey = (key: string) => {
  const m = key.match(/^s(\d+)e(\d+)$/);
  return m ? { season: Number(m[1]), number: Number(m[2]) } : null;
};

const upTo = (a: { season: number; number: number }, b: { season: number; number: number }) => a.season < b.season || (a.season === b.season && a.number <= b.number);

/** Every regular episode that has aired, in order. */
export function airedKeys(t: Pick<Track, 'seasons' | 'lastAired'>): string[] {
  if (!t.lastAired) return [];
  const out: string[] = [];
  for (const s of [...t.seasons].sort((a, b) => a.n - b.n)) {
    for (let e = 1; e <= s.count; e++) if (upTo({ season: s.n, number: e }, t.lastAired)) out.push(epKey(s.n, e));
  }
  return out;
}

/** The next aired episode not seen yet, in order. */
export function nextUp(t: Track): { season: number; number: number } | null {
  const key = airedKeys(t).find((k) => !t.seen[k]);
  return key ? parseKey(key) : null;
}

export function counts(t: Track) {
  const aired = airedKeys(t);
  const seen = aired.filter((k) => t.seen[k]).length;
  const total = t.seasons.reduce((n, s) => n + s.count, 0);
  return { aired: aired.length, seen, total, left: aired.length - seen };
}

/** "S1 · Ep 3–5", "S1 · Ep 3, 7", "S1 · Ep 9–10 · S2 · Ep 1": what a day's episodes add up to. */
export function progressLabel(keys: string[]): string {
  const bySeason = new Map<number, number[]>();
  for (const k of keys) {
    const e = parseKey(k);
    if (e) bySeason.set(e.season, [...(bySeason.get(e.season) ?? []), e.number]);
  }
  return [...bySeason.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([s, nums]) => {
      const sorted = [...new Set(nums)].sort((a, b) => a - b);
      const runs: string[] = [];
      for (let i = 0; i < sorted.length; i++) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
        runs.push(j > i ? `${sorted[i]}–${sorted[j]}` : String(sorted[i]));
        i = j;
      }
      return `S${s} · Ep ${runs.join(', ')}`;
    })
    .join(' · ');
}

export const newTrack = (now: number): Track => ({ status: 'watching', seen: {}, seasons: [], lastAired: null, nextAir: null, ended: false, checkedAt: 0, startedAt: now });

/** A track with fresh show details. */
export function withInfo(t: Track | undefined, info: ShowInfo, now: number): Track {
  const base = t ?? newTrack(now);
  return settle({ ...base, seasons: info.seasons.map(({ n, count }) => ({ n, count })), lastAired: info.lastAired, nextAir: info.nextAir, ended: info.ended, checkedAt: now });
}

/** Completed once an ended show is all seen; back to watching if new episodes appear. */
export function settle(t: Track): Track {
  const c = counts(t);
  if (t.ended && c.aired > 0 && c.left === 0 && t.status === 'watching') return { ...t, status: 'completed' };
  if (t.status === 'completed' && c.left > 0) return { ...t, status: 'watching' };
  return t;
}

const DAY = 24 * 60 * 60 * 1000;

/** The day you last ticked an episode of it (or started tracking). */
export function lastSeenDay(t: Track): string {
  const days = Object.values(t.seen).sort();
  return days[days.length - 1] ?? new Date(t.startedAt).toISOString().slice(0, 10);
}

/**
 * Continue watching, grouped the way you'd think about it: ONGOING (watched in the last month, episodes
 * waiting), OLD FRIENDS (episodes waiting, untouched for a month), COMING BACK (all caught up, more to come).
 */
export function continueWatching(items: WatchItem[], todayIso: string) {
  const ongoing: WatchItem[] = [];
  const oldFriends: WatchItem[] = [];
  const comingBack: WatchItem[] = [];
  const today = Date.parse(todayIso);
  for (const w of items) {
    const t = w.track;
    if (!t || t.status === 'dropped' || t.status === 'completed') continue;
    const c = counts(t);
    const idle = (today - Date.parse(lastSeenDay(t))) / DAY;
    if (c.left > 0) (t.status === 'watching' && idle <= 30 ? ongoing : oldFriends).push(w);
    else if (!t.ended) comingBack.push(w);
  }
  const recent = (a: WatchItem, b: WatchItem) => lastSeenDay(b.track!).localeCompare(lastSeenDay(a.track!));
  const soonest = (a: WatchItem, b: WatchItem) => (a.track!.nextAir?.date ?? '9999').localeCompare(b.track!.nextAir?.date ?? '9999');
  return { ongoing: ongoing.sort(recent), oldFriends: oldFriends.sort(recent), comingBack: comingBack.sort(soonest) };
}
