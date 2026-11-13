import type { ShowInfo } from '@/api/episodes';
import { isoDate } from '@/lib/dates';
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
  const upcoming = info.upcoming ?? base.upcoming;
  // The next episode's day in your own time zone, when its exact time is known.
  const local = upcoming?.find((e) => e.season === info.nextAir?.season && e.number === info.nextAir?.number);
  const nextAir = local ? { season: local.season, number: local.number, date: local.date } : info.nextAir;
  return settle({ ...base, seasons: info.seasons.map(({ n, count }) => ({ n, count })), lastAired: info.lastAired, nextAir, upcoming, ended: info.ended, checkedAt: now });
}

/** The season you're on: the latest one you've ticked an episode of. 0 before you've started. */
export function seasonOn(seen: Track['seen']) {
  return Math.max(0, ...Object.keys(seen).map((k) => parseKey(k)?.season ?? 0));
}

/** How many tick and untick times a show keeps, newest first, and for how long. Older ones merge as before. */
export const MOST_CHANGES = 200;
export const CHANGES_KEPT_MS = 60 * 24 * 60 * 60 * 1000;

/** The newest `MOST_CHANGES` times, none older than `CHANGES_KEPT_MS` when `now` is given; undefined when none are left. */
function pruned(changed: Record<string, number>, now?: number): Record<string, number> | undefined {
  const kept = Object.entries(changed)
    .filter(([, at]) => now === undefined || now - at <= CHANGES_KEPT_MS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MOST_CHANGES);
  return kept.length ? Object.fromEntries(kept) : undefined;
}

/** `next`, with the time of every episode ticked or unticked since `before`, for merging with another phone. */
export function stamped(before: Pick<Track, 'seen'> | undefined, next: Track, now: number): Track {
  const was = before?.seen ?? {};
  const changed = { ...next.changed };
  let any = false;
  for (const k of new Set([...Object.keys(was), ...Object.keys(next.seen)])) {
    if (!was[k] === !next.seen[k]) continue;
    changed[k] = now;
    any = true;
  }
  if (!any) return next;
  const out: Track = { ...next, changed: pruned(changed, now) };
  if (!out.changed) delete out.changed;
  return out;
}

/**
 * Two phones changed the same show: the newer details win, and every tick and rating from both stays,
 * except where one phone unticked an episode after the other ticked it. That's known from `changed`;
 * an episode neither phone has a time for (an older app version's change) keeps its tick, as before.
 */
export function mergeTrack(mine: Track, theirs: Track): Track {
  const fresher = theirs.checkedAt > mine.checkedAt ? theirs : mine;
  const seen = { ...theirs.seen, ...mine.seen };
  const ratings = { ...theirs.ratings, ...mine.ratings };
  const changed: Record<string, number> = { ...theirs.changed };
  for (const [k, at] of Object.entries(mine.changed ?? {})) if (!(changed[k] > at)) changed[k] = at;

  for (const k of Object.keys(changed)) {
    const m = mine.changed?.[k];
    const t = theirs.changed?.[k];
    // The phone that changed this episode last. A tie keeps the tick, as before.
    const last = t === undefined || (m !== undefined && m > t) ? mine : m === undefined || t > m ? theirs : null;
    if (!last) continue;
    if (last.seen[k]) {
      seen[k] = last.seen[k];
      continue;
    }
    const other = last === mine ? theirs : mine;
    // The other phone has no time for it (an older version ticked it): its tick wins only from a later day.
    if (other.changed?.[k] === undefined && other.seen[k] && other.seen[k] > isoDate(new Date(changed[k]))) {
      delete changed[k];
      continue;
    }
    delete seen[k];
    delete ratings[k];
  }

  const merged: Track = { ...mine, ...(fresher === theirs ? { seasons: theirs.seasons, lastAired: theirs.lastAired, nextAir: theirs.nextAir, upcoming: theirs.upcoming, ended: theirs.ended, checkedAt: theirs.checkedAt } : {}), seen, ratings };
  const times = pruned(changed);
  if (times) merged.changed = times;
  else delete merged.changed;
  return settle(merged);
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
  return days[days.length - 1] ?? isoDate(new Date(t.startedAt));
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
