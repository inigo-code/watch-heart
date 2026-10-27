import { useEffect, useRef } from 'react';

import { tmdbKey } from '@/api';
import { tmdbById } from '@/api/tmdb';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Entry, WatchItem } from '@/store/types';

// TMDB's terms don't allow keeping its data (posters, genres, running times, credits) for longer than
// 6 months. Titles from TMDB are refreshed after about 5 months; if they can't be (no key), their
// TMDB details are removed after 6, keeping your title, year, rating and review. A key brings them back.

const DAY = 24 * 60 * 60 * 1000;
export const REFRESH_AFTER = 150 * DAY;
export const KEEP_AT_MOST = 180 * DAY;
// Spread the work out: a big diary catches up over a few launches instead of all at once.
const PER_LAUNCH = 40;

type Fresh = Pick<Entry, 'source' | 'sourceId' | 'posterUrl' | 'backdropUrl' | 'genres' | 'runtime' | 'credit' | 'fetchedAt'>;

/** When a record's TMDB details were fetched (older records count from when they were added). */
export const fetchedTime = (r: Fresh, addedAt: number) => r.fetchedAt ?? addedAt;

const hasDetails = (r: Fresh) => !!(r.posterUrl || r.backdropUrl || r.genres.length || r.runtime || r.credit);

/** The TMDB details removed when they're too old to keep and can't be refreshed. */
export const stripped = () => ({ posterUrl: null, backdropUrl: null, genres: [] as string[], runtime: null, credit: null, fetchedAt: 0 });

/** Which records need attention now: refresh (when there's a key) or strip (when there isn't). */
export function planFreshness<T extends Fresh>(records: T[], addedAt: (r: T) => number, now: number, haveKey: boolean) {
  const fromTmdb = records.filter((r) => r.source === 'tmdb' && r.sourceId.includes(':'));
  if (haveKey) return { refresh: fromTmdb.filter((r) => now - fetchedTime(r, addedAt(r)) > REFRESH_AFTER), strip: [] as T[] };
  return { refresh: [] as T[], strip: fromTmdb.filter((r) => now - fetchedTime(r, addedAt(r)) > KEEP_AT_MOST && hasDetails(r)) };
}

/** Runs once per launch (and again if a key is added): keeps TMDB details within TMDB's 6-month limit. */
export function useTmdbFreshness() {
  const { ready, entries, trash, watchlist, updateEntry, updateWatchItem } = useDiary();
  const { settings, ready: settingsReady } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !settingsReady || ranFor.current === key) return;
    ranFor.current = key;
    const now = Date.now();
    const diary = planFreshness([...entries, ...trash], (e) => e.createdAt, now, !!key);
    const queued = planFreshness(watchlist, (w) => w.addedAt, now, !!key);

    for (const e of diary.strip) updateEntry(e.id, stripped());
    for (const w of queued.strip) updateWatchItem(w.id, stripped());
    if (!key) return;

    const jobs: (() => Promise<void>)[] = [
      ...diary.refresh.map((e) => () => refresh(key, e).then((patch) => patch && updateEntry(e.id, patch))),
      ...queued.refresh.map((w) => () => refresh(key, w).then((patch) => patch && updateWatchItem(w.id, patch))),
    ].slice(0, PER_LAUNCH);
    let cancelled = false;
    const worker = async () => {
      while (jobs.length && !cancelled) await jobs.shift()?.().catch(() => {});
    };
    void Promise.all([worker(), worker()]);
    return () => {
      cancelled = true;
    };
    // Once per launch (or key change), with whatever the diary holds then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, settingsReady, key]);
}

/** Fresh TMDB details for one record; your own title wording and the kind you chose are kept. */
async function refresh(key: string, r: Entry | WatchItem) {
  const [type, id] = r.sourceId.split(':') as ['movie' | 'tv', string];
  const t = await tmdbById(key, type, id);
  return {
    year: t.year ?? r.year,
    posterUrl: t.posterUrl,
    backdropUrl: t.backdropUrl,
    genres: t.genres,
    runtime: t.runtime,
    credit: t.credit ?? null,
    fetchedAt: Date.now(),
  };
}
