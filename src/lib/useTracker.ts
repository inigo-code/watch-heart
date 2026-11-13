import { useCallback } from 'react';

import { comingEpisodes, showInfo } from '@/api/episodes';
import type { ShowInfo } from '@/api/episodes';
import { today } from '@/lib/dates';
import { epKey, newTrack, parseKey, progressLabel, settle, stamped, withInfo } from '@/lib/tracking';
import { useSettings } from '@/settings/SettingsProvider';
import { titleOf, useDiary } from '@/store/DiaryStore';
import type { Title, Track, TrackStatus, WatchItem } from '@/store/types';

// What the tracker does to the diary:
// - Tracking a show keeps it on the watchlist (it shows under Continue watching, not Up next).
// - Ticking one episode logs it: today's diary entry for the show gains it ("S1 · Ep 3–4"), or a new
//   one is made. Unticking takes it out again (an entry left with nothing in it goes).
// - Catching up (a whole season, or "up to here") only marks episodes seen, without diary entries.

/** The season these episodes make up in full, if they're all of one season and all of it. */
function wholeSeason(keys: string[], track?: Track) {
  const eps = keys.map(parseKey);
  const n = eps[0]?.season;
  if (!n || eps.some((e) => e?.season !== n)) return null;
  const count = track?.seasons.find((s) => s.n === n)?.count;
  return count && new Set(keys).size >= count ? n : null;
}

export function useTracker() {
  const { settings } = useSettings();
  const { entries, onWatchlist, addToWatchlist, updateWatchItem, addEntry, updateEntry, purgeEntry } = useDiary();

  /** The show's watchlist item, made (and tracked) if it isn't there yet. */
  const ensure = useCallback(
    (t: Title | WatchItem): WatchItem => {
      const found = onWatchlist(t);
      if (found) {
        if (!found.track) {
          const track = newTrack(Date.now());
          updateWatchItem(found.id, { track });
          return { ...found, track };
        }
        return found;
      }
      const item = addToWatchlist('note' in t ? titleOf(t) : t);
      const track = newTrack(Date.now());
      updateWatchItem(item.id, { track });
      return { ...item, track };
    },
    [onWatchlist, addToWatchlist, updateWatchItem],
  );

  // Every tick and untick goes through here, so each one is timed for merging with another phone.
  const save = useCallback((item: WatchItem, track: Track) => updateWatchItem(item.id, { track: settle(stamped(item.track, track, Date.now())) }), [updateWatchItem]);

  /** The tracked item for a show (tracking it now if needed), with season details when they're known. */
  const tracked = useCallback(
    (t: Title | WatchItem, info?: ShowInfo): WatchItem => {
      const it = 'note' in t && t.track ? t : ensure(t);
      const track = it.track!;
      return info && !track.seasons.length ? { ...it, track: withInfo(track, info, Date.now()) } : it;
    },
    [ensure],
  );

  /** Fetches seasons and air dates and stores them on the item. */
  const refresh = useCallback(
    async (item: WatchItem, signal?: AbortSignal) => {
      const info = await showInfo(settings.tmdbKey, item.source, item.sourceId, signal);
      const upcoming = info.nextAir ? await comingEpisodes(settings.tmdbKey, item.source, item.sourceId, info.nextAir, signal).catch(() => undefined) : [];
      const now = Date.now();
      updateWatchItem(item.id, (w) => ({ track: withInfo(w.track, { ...info, upcoming }, now) }), { quiet: true });
      return { info };
    },
    [settings.tmdbKey, updateWatchItem],
  );

  /** Today's tracker entry for this show, if there is one. */
  const todays = useCallback(
    (item: WatchItem) => entries.find((e) => e.episodes && e.watchedOn === today() && e.source === item.source && e.sourceId === item.sourceId),
    [entries],
  );

  /** Takes episodes back out of the diary, wherever they were logged. An entry left with nothing of yours goes too. */
  const unlog = useCallback(
    (item: WatchItem, keys: string[]) => {
      const gone = new Set(keys);
      for (const e of entries) {
        if (e.source !== item.source || e.sourceId !== item.sourceId || !e.episodes?.some((k) => gone.has(k))) continue;
        const episodes = e.episodes.filter((k) => !gone.has(k));
        const yours = !!e.rating || e.liked || !!e.review.trim();
        if (!episodes.length && !yours) {
          purgeEntry(e.id);
          continue;
        }
        const episodeRatings = Object.fromEntries(Object.entries(e.episodeRatings ?? {}).filter(([k]) => !gone.has(k)));
        updateEntry(e.id, { episodes, episodeRatings, progress: progressLabel(episodes), season: yours ? e.season : null });
      }
    },
    [entries, updateEntry, purgeEntry],
  );

  /** A new diary entry for a viewing of this show, today. */
  const logNew = useCallback(
    (item: WatchItem, viewing: { episodes: string[]; season?: number | null; episodeRatings?: Record<string, number> }) =>
      addEntry({
            kind: item.kind,
            source: item.source,
            sourceId: item.sourceId,
            title: item.title,
            originalTitle: item.originalTitle,
            year: item.year,
            posterUrl: item.posterUrl,
            backdropUrl: item.backdropUrl,
            genres: item.genres,
            runtime: item.runtime,
            credit: item.credit,
            watchedOn: today(),
            rating: 0,
            liked: false,
            rewatch: false,
            progress: progressLabel(viewing.episodes),
            review: '',
            spoilers: false,
            tags: [],
            fetchedAt: item.fetchedAt ?? null,
            ...viewing,
      }),
    [addEntry],
  );

  const logEpisode = useCallback(
    (item: WatchItem, key: string, seen: boolean, track?: Track, rating?: number) => {
      const e = todays(item);
      if (seen) {
        const episodes = [...new Set([...(e?.episodes ?? []), key])];
        // Every episode of a season in one sitting reads as the season.
        const season = wholeSeason(episodes, track ?? item.track);
        const episodeRatings = rating ? { ...e?.episodeRatings, [key]: rating } : e?.episodeRatings;
        if (e) updateEntry(e.id, { episodes, progress: progressLabel(episodes), episodeRatings, season: season ?? e.season });
        else logNew(item, { episodes, season, episodeRatings });
      } else unlog(item, [key]);
    },
    [todays, logNew, updateEntry, unlog],
  );

  /** Ticks (or unticks) one episode and logs it in today's diary. */
  const toggle = useCallback(
    (target: WatchItem | Title, season: number, number: number, info?: ShowInfo) => {
      const it = tracked(target, info);
      const track = it.track!;
      const key = epKey(season, number);
      const seen = { ...track.seen };
      const ratings = { ...track.ratings };
      const now = !seen[key];
      if (now) seen[key] = today();
      else {
        delete seen[key];
        delete ratings[key];
      }
      const next = { ...track, seen, ratings, status: track.status === 'paused' || track.status === 'dropped' ? 'watching' : track.status } as Track;
      save(it, next);
      logEpisode(it, key, now, next);
    },
    [tracked, save, logEpisode],
  );

  /** Marks several episodes seen (or not) at once, without diary entries: catching up. */
  const markMany = useCallback(
    (target: WatchItem | Title, keys: string[], seenNow: boolean, info?: ShowInfo) => {
      const it = tracked(target, info);
      const seen = { ...it.track!.seen };
      const ratings = { ...it.track!.ratings };
      for (const k of keys) {
        if (seenNow) seen[k] = seen[k] ?? today();
        else {
          delete seen[k];
          delete ratings[k];
        }
      }
      save(it, { ...it.track!, seen, ratings });
      if (!seenNow) unlog(it, keys);
    },
    [tracked, save, unlog],
  );

  /** Marks a whole season seen, as one diary entry (or takes that back). What was already seen isn't logged twice. */
  const logSeason = useCallback(
    (target: WatchItem | Title, season: number, keys: string[], done: boolean, info?: ShowInfo) => {
      const it = tracked(target, info);
      const track = it.track!;
      const seen = { ...track.seen };
      const ratings = { ...track.ratings };
      const fresh = keys.filter((k) => !seen[k]);
      for (const k of keys) {
        if (done) seen[k] = seen[k] ?? today();
        else {
          delete seen[k];
          delete ratings[k];
        }
      }
      save(it, { ...track, seen, ratings });
      if (done) {
        if (!fresh.length) return;
        const e = todays(it);
        const episodes = [...new Set([...(e?.episodes ?? []), ...fresh])];
        if (e) updateEntry(e.id, { episodes, progress: progressLabel(episodes), season });
        else logNew(it, { episodes, season });
        return;
      }
      unlog(it, keys);
    },
    [tracked, save, todays, logNew, updateEntry, unlog],
  );

  /** Your stars for one episode (0 clears them). Rating one you haven't ticked logs it, since you've seen it. */
  const rateEpisode = useCallback(
    (target: WatchItem | Title, key: string, rating: number, info?: ShowInfo) => {
      const it = tracked(target, info);
      const track = it.track!;
      const ratings = { ...track.ratings };
      if (rating) ratings[key] = rating;
      else delete ratings[key];
      const fresh = !!rating && !track.seen[key];
      const next: Track = { ...track, ratings, seen: fresh ? { ...track.seen, [key]: today() } : track.seen };
      save(it, next);
      if (fresh) {
        logEpisode(it, key, true, next, rating);
        return;
      }
      const e = entries.find((x) => x.episodes?.includes(key) && x.source === it.source && x.sourceId === it.sourceId);
      if (!e) return;
      const episodeRatings = { ...e.episodeRatings };
      if (rating) episodeRatings[key] = rating;
      else delete episodeRatings[key];
      updateEntry(e.id, { episodeRatings });
    },
    [tracked, save, logEpisode, entries, updateEntry],
  );

  const setStatus = useCallback(
    (target: WatchItem | Title, status: TrackStatus, info?: ShowInfo) => {
      const it = tracked(target, info);
      updateWatchItem(it.id, { track: { ...it.track!, status } });
    },
    [tracked, updateWatchItem],
  );

  return { ensure, refresh, toggle, markMany, logSeason, rateEpisode, setStatus };
}
