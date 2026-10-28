import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { tmdbKey } from '@/api';
import { matchTmdb, tmdbById } from '@/api/tmdb';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Entry, Title, WatchItem } from '@/store/types';

// Keeps TMDB details in the diary and watchlist complete and within TMDB's terms, in the background:
// - Posters for anything without one (imports, titles typed in by hand) are found automatically: exactly
//   by IMDb id when known, otherwise by name and year. Titles TMDB doesn't know are retried after 2 weeks.
// - Titles linked to TMDB without details yet (a Trakt import) get them straight away.
// - TMDB's terms don't allow keeping its data for longer than 6 months, so details are refreshed after
//   about 5; without a key to refresh with, details older than 6 months are removed (your title, year,
//   rating and review stay, and a key brings the rest back).

const DAY = 24 * 60 * 60 * 1000;
export const REFRESH_AFTER = 150 * DAY;
export const KEEP_AT_MOST = 180 * DAY;
const RETRY_UNMATCHED_AFTER = 14 * DAY;
// Routine refreshes are spread out; a big diary catches up over a few launches instead of all at once.
const REFRESH_PER_RUN = 40;
const WORKERS = 3;
// Results are saved in batches, so a big import doesn't redraw the app hundreds of times.
const FLUSH_EVERY = 20;

type Fresh = Pick<Entry, 'source' | 'sourceId' | 'title' | 'posterUrl' | 'backdropUrl' | 'genres' | 'runtime' | 'credit' | 'fetchedAt' | 'matchTriedAt'>;

/** When a record's TMDB details were fetched (older records count from when they were added). */
export const fetchedTime = (r: Fresh, addedAt: number) => r.fetchedAt ?? addedAt;

const hasDetails = (r: Fresh) => !!(r.posterUrl || r.backdropUrl || r.genres.length || r.runtime || r.credit);
const linked = (r: Fresh) => r.source === 'tmdb' && r.sourceId.includes(':');

/**
 * Records linked to a TMDB series but still marked as films: imports from film-only apps (Letterboxd
 * lists TV miniseries too) were matched to the series without their kind changing.
 */
export const wrongKind = <T extends Pick<Entry, 'source' | 'sourceId' | 'kind'>>(records: T[]) =>
  records.filter((r) => r.source === 'tmdb' && r.sourceId.startsWith('tv:') && r.kind === 'movie');

/** The TMDB details removed when they're too old to keep and can't be refreshed. */
export const stripped = () => ({ posterUrl: null, backdropUrl: null, genres: [] as string[], runtime: null, credit: null, fetchedAt: 0 });

/** What each record needs now. Pure, so it's easy to check. */
export function planUpkeep<T extends Fresh>(records: T[], addedAt: (r: T) => number, now: number, haveKey: boolean, force = false) {
  if (!haveKey) {
    return { details: [] as T[], match: [] as T[], refresh: [] as T[], strip: records.filter((r) => linked(r) && now - fetchedTime(r, addedAt(r)) > KEEP_AT_MOST && hasDetails(r)) };
  }
  return {
    details: records.filter((r) => linked(r) && (r.fetchedAt === 0 || !hasDetails(r))),
    match: records.filter((r) => r.source === 'manual' && r.title.trim() && !r.posterUrl && (force || !r.matchTriedAt || now - r.matchTriedAt > RETRY_UNMATCHED_AFTER)),
    refresh: records.filter((r) => linked(r) && r.fetchedAt !== 0 && hasDetails(r) && now - fetchedTime(r, addedAt(r)) > REFRESH_AFTER),
    strip: [] as T[],
  };
}

// --- Progress, for Settings and the import screen ------------------------------------------------

export type UpkeepProgress = { running: boolean; done: number; total: number; found: number };
let progress: UpkeepProgress = { running: false, done: 0, total: 0, found: 0 };
let forceToken = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setProgress = (p: Partial<UpkeepProgress>) => {
  progress = { ...progress, ...p };
  emit();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Live progress of the background poster search. */
export const useUpkeepProgress = () => useSyncExternalStore(subscribe, () => progress);
const useForceToken = () => useSyncExternalStore(subscribe, () => forceToken);

/** Look for posters now, including titles that weren't found recently. */
export function findPostersNow() {
  forceToken++;
  emit();
}

/** Mounted once (in the root layout): does the work above whenever there is some. */
export function useTmdbFreshness() {
  const { ready, entries, trash, watchlist, patchMany } = useDiary();
  const { settings, ready: settingsReady } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const force = useForceToken();
  const running = useRef(false);
  const refreshedFor = useRef<string | null>(null);
  const lastForce = useRef(0);
  const latest = useRef({ entries, trash, watchlist });
  useEffect(() => {
    latest.current = { entries, trash, watchlist };
  }, [entries, trash, watchlist]);

  // Re-plan when the amount of work changes (an import adds titles without posters, say). Counted
  // against the launch time; each run plans again with the current time.
  const [now] = useState(() => Date.now());
  const diaryPlan = planUpkeep([...entries, ...trash], (e) => e.createdAt, now, !!key);
  const watchPlan = planUpkeep(watchlist, (w) => w.addedAt, now, !!key);
  const misKinded = wrongKind([...entries, ...trash]).length + wrongKind(watchlist).length;
  const pending = diaryPlan.details.length + diaryPlan.match.length + watchPlan.details.length + watchPlan.match.length + diaryPlan.strip.length + watchPlan.strip.length + misKinded;

  useEffect(() => {
    if (!ready || !settingsReady || running.current) return;
    const forced = force !== lastForce.current;
    lastForce.current = force;
    const firstForKey = refreshedFor.current !== key;
    if (!pending && !forced && !firstForKey) return;
    refreshedFor.current = key;

    const at = Date.now();
    const { entries: es, trash: ts, watchlist: ws } = latest.current;
    const d = planUpkeep([...es, ...ts], (e) => e.createdAt, at, !!key, forced);
    const w = planUpkeep(ws, (x) => x.addedAt, at, !!key, forced);

    if (d.strip.length || w.strip.length) {
      patchMany(
        d.strip.map((e) => ({ id: e.id, patch: stripped() })),
        w.strip.map((x) => ({ id: x.id, patch: stripped() })),
      );
    }
    const dk = wrongKind([...es, ...ts]);
    const wk = wrongKind(ws);
    if (dk.length || wk.length) {
      patchMany(
        dk.map((e) => ({ id: e.id, patch: { kind: 'tv' as const } })),
        wk.map((x) => ({ id: x.id, patch: { kind: 'tv' as const } })),
      );
    }
    if (!key) return;

    type Job = { list: 'diary' | 'watch'; record: Entry | WatchItem; run: () => Promise<Partial<Entry> | null> };
    const jobs: Job[] = [
      ...d.details.map((e) => ({ list: 'diary' as const, record: e, run: () => refresh(key, e) })),
      ...w.details.map((x) => ({ list: 'watch' as const, record: x, run: () => refresh(key, x) })),
      ...d.match.map((e) => ({ list: 'diary' as const, record: e, run: () => match(key, e) })),
      ...w.match.map((x) => ({ list: 'watch' as const, record: x, run: () => match(key, x) })),
      // Routine refreshes only once per launch (or key), and only so many.
      ...(firstForKey
        ? [...d.refresh.map((e) => ({ list: 'diary' as const, record: e })), ...w.refresh.map((x) => ({ list: 'watch' as const, record: x }))]
            .slice(0, REFRESH_PER_RUN)
            .map((j) => ({ ...j, run: () => refresh(key, j.record) }))
        : []),
    ];
    if (!jobs.length) return;

    running.current = true;
    let cancelled = false;
    let done = 0;
    let found = 0;
    const buffer = { diary: [] as { id: string; patch: Partial<Entry> }[], watch: [] as { id: string; patch: Partial<WatchItem> }[] };
    const flush = () => {
      if (!buffer.diary.length && !buffer.watch.length) return;
      patchMany(buffer.diary.splice(0), buffer.watch.splice(0));
    };
    setProgress({ running: true, done: 0, total: jobs.length, found: 0 });

    const queue = [...jobs];
    const worker = async () => {
      while (queue.length && !cancelled) {
        const job = queue.shift()!;
        const patch = await job.run().catch(() => null);
        done++;
        if (patch) {
          if (patch.posterUrl) found++;
          (job.list === 'diary' ? buffer.diary : buffer.watch).push({ id: job.record.id, patch });
        }
        if (buffer.diary.length + buffer.watch.length >= FLUSH_EVERY) flush();
        setProgress({ done, found });
      }
    };
    void Promise.all(Array.from({ length: WORKERS }, worker)).finally(() => {
      flush();
      running.current = false;
      setProgress({ running: false });
    });
    return () => {
      cancelled = true;
    };
    // Planned from the latest diary when started; restarts when the pending count, key or a manual
    // "find posters" request changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, settingsReady, key, pending, force]);
}

/** Fresh TMDB details for a linked record; your own title wording is kept. */
async function refresh(key: string, r: Entry | WatchItem): Promise<Partial<Entry>> {
  const [type, id] = r.sourceId.split(':') as ['movie' | 'tv', string];
  const t = await tmdbById(key, type, id);
  return { ...details(t, r), fetchedAt: Date.now() };
}

/** Finds a record on TMDB and links it; when there's no match, notes the try so it waits a while. */
async function match(key: string, r: Entry | WatchItem): Promise<Partial<Entry>> {
  const t = await matchTmdb(key, { title: r.title, year: r.year, kind: r.kind, imdbId: r.imdbId });
  if (!t) return { matchTriedAt: Date.now() };
  return {
    ...details(t, r),
    source: 'tmdb',
    sourceId: t.sourceId,
    originalTitle: r.originalTitle ?? t.originalTitle ?? null,
    // What TMDB found decides between film and series (a film-only app's "film" can be a miniseries,
    // and Japanese animation is anime); something you filed as anime yourself stays anime.
    kind: r.kind === 'anime' ? 'anime' : t.kind,
    fetchedAt: Date.now(),
    matchTriedAt: null,
  };
}

/** TMDB's details, keeping what the record already had where TMDB has nothing. */
function details(t: Title, r: Entry | WatchItem): Partial<Entry> {
  return {
    year: r.year ?? t.year,
    posterUrl: t.posterUrl ?? r.posterUrl,
    backdropUrl: t.backdropUrl ?? r.backdropUrl,
    genres: t.genres.length ? t.genres : r.genres,
    runtime: t.runtime ?? r.runtime,
    credit: t.credit ?? r.credit ?? null,
  };
}
