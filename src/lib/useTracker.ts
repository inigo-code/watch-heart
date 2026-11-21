import { useCallback } from 'react';

import { comingEpisodes, showInfo } from '@/api/episodes';
import type { ShowInfo } from '@/api/episodes';
import { today } from '@/lib/dates';
import { useHaptic } from '@/lib/haptics';
import { epKey, newTrack, parseKey, progressLabel, redated, seenDay, settle, stamped, withInfo } from '@/lib/tracking';
import type { Day } from '@/lib/tracking';
import { useSettings } from '@/settings/SettingsProvider';
import { titleOf, useDiary } from '@/store/DiaryStore';
import type { Entry, Title, Track, TrackStatus, WatchItem } from '@/store/types';

// What the tracker does to the diary:
// - Tracking a show keeps it on the watchlist (it shows under Continue watching, not Up next).
// - Ticking one episode logs it on the day you chose (today unless you pick another, or "don't remember"):
//   that day's diary entry for the show gains it ("S1 · Ep 3–4"), or a new one is made. Unticking takes it
//   out again (an entry left with nothing in it goes).
// - Catching up ("up to here") only marks episodes seen, without diary entries.
// - A diary entry's date changing moves its episodes' seen day with it.

const TODAY = (): Day => ({ watchedOn: today() });

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
  const haptic = useHaptic();
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

  /**
   * The tracker's entry for this show on that day (or among the days you don't remember), if there is one.
   * An entry about another season (its rating and review are for that season) isn't added to.
   */
  const dayEntry = useCallback(
    (item: WatchItem, when: Day, season: number | undefined) =>
      entries.find(
        (e) =>
          e.episodes &&
          e.source === item.source &&
          e.sourceId === item.sourceId &&
          (when.undated ? !!e.undated : !e.undated && e.watchedOn === when.watchedOn) &&
          (!e.season || e.season === season),
      ),
    [entries],
  );

  /**
   * Takes episodes back out of the diary, wherever they were logged (except the entry `keep`). An entry left
   * with nothing of yours goes too.
   */
  const unlog = useCallback(
    (item: WatchItem, keys: string[], keep?: string) => {
      const gone = new Set(keys);
      for (const e of entries) {
        if (e.id === keep || e.source !== item.source || e.sourceId !== item.sourceId || !e.episodes?.some((k) => gone.has(k))) continue;
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

  /** A new diary entry for a viewing of this show, on that day. */
  const logNew = useCallback(
    (item: WatchItem, when: Day, viewing: { episodes: string[]; season?: number | null; episodeRatings?: Record<string, number> }) =>
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
        // A day you don't remember keeps today in watchedOn, as the log form does; `undated` puts it in the Archive.
        watchedOn: when.undated ? today() : when.watchedOn,
        ...(when.undated ? { undated: true } : {}),
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
    (item: WatchItem, key: string, seen: boolean, when: Day, track?: Track, rating?: number) => {
      if (!seen) {
        unlog(item, [key]);
        return;
      }
      const e = dayEntry(item, when, parseKey(key)?.season);
      const episodes = [...new Set([...(e?.episodes ?? []), key])];
      // Every episode of a season in one sitting reads as the season.
      const season = wholeSeason(episodes, track ?? item.track);
      const episodeRatings = rating ? { ...e?.episodeRatings, [key]: rating } : e?.episodeRatings;
      if (e) updateEntry(e.id, { episodes, progress: progressLabel(episodes), episodeRatings, season: season ?? e.season });
      else logNew(item, when, { episodes, season, episodeRatings });
    },
    [dayEntry, logNew, updateEntry, unlog],
  );

  /** Ticks (or unticks) one episode and logs it in the diary on that day (today unless you chose another). */
  const toggle = useCallback(
    (target: WatchItem | Title, season: number, number: number, info?: ShowInfo, when: Day = TODAY()) => {
      const it = tracked(target, info);
      const track = it.track!;
      const key = epKey(season, number);
      const seen = { ...track.seen };
      const ratings = { ...track.ratings };
      const now = !seen[key];
      if (now) seen[key] = seenDay(when);
      else {
        delete seen[key];
        delete ratings[key];
      }
      const next = { ...track, seen, ratings, status: track.status === 'paused' || track.status === 'dropped' ? 'watching' : track.status } as Track;
      save(it, next);
      logEpisode(it, key, now, when, next);
      haptic('tick');
    },
    [tracked, save, logEpisode, haptic],
  );

  /**
   * Marks several episodes seen (or not) at once, without diary entries: catching up. Returns the episodes
   * that weren't seen before, so a diary entry can claim them.
   */
  const markMany = useCallback(
    (target: WatchItem | Title, keys: string[], seenNow: boolean, info?: ShowInfo, when: Day = TODAY()) => {
      const it = tracked(target, info);
      const seen = { ...it.track!.seen };
      const ratings = { ...it.track!.ratings };
      const fresh = keys.filter((k) => !seen[k]);
      for (const k of keys) {
        if (seenNow) seen[k] = seen[k] ?? seenDay(when);
        else {
          delete seen[k];
          delete ratings[k];
        }
      }
      save(it, { ...it.track!, seen, ratings });
      if (!seenNow) unlog(it, keys);
      return seenNow ? fresh : [];
    },
    [tracked, save, unlog],
  );

  /** Marks a whole season seen, as one diary entry on that day (or takes that back). What was already seen isn't logged twice. */
  const logSeason = useCallback(
    (target: WatchItem | Title, season: number, keys: string[], done: boolean, info?: ShowInfo, when: Day = TODAY()) => {
      const it = tracked(target, info);
      const track = it.track!;
      const seen = { ...track.seen };
      const ratings = { ...track.ratings };
      const fresh = keys.filter((k) => !seen[k]);
      for (const k of keys) {
        if (done) seen[k] = seen[k] ?? seenDay(when);
        else {
          delete seen[k];
          delete ratings[k];
        }
      }
      save(it, { ...track, seen, ratings });
      if (done) {
        if (!fresh.length) return;
        const e = dayEntry(it, when, season);
        const episodes = [...new Set([...(e?.episodes ?? []), ...fresh])];
        if (e) updateEntry(e.id, { episodes, progress: progressLabel(episodes), season });
        else logNew(it, when, { episodes, season });
        return;
      }
      unlog(it, keys);
    },
    [tracked, save, dayEntry, logNew, updateEntry, unlog],
  );

  /** Your stars for one episode (0 clears them). Rating one you haven't ticked logs it (on that day), since you've seen it. */
  const rateEpisode = useCallback(
    (target: WatchItem | Title, key: string, rating: number, info?: ShowInfo, when: Day = TODAY()) => {
      const it = tracked(target, info);
      const track = it.track!;
      const ratings = { ...track.ratings };
      if (rating) ratings[key] = rating;
      else delete ratings[key];
      const fresh = !!rating && !track.seen[key];
      const next: Track = { ...track, ratings, seen: fresh ? { ...track.seen, [key]: seenDay(when) } : track.seen };
      save(it, next);
      if (fresh) {
        logEpisode(it, key, true, when, next, rating);
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

  /**
   * Logs these episodes as seen on that day: unseen ones are ticked, seen ones move to it. In the diary they
   * leave the viewings they were in (an entry left with nothing of yours goes) and join that day's entry, with
   * your stars for them.
   */
  const logOn = useCallback(
    (target: WatchItem | Title, keys: string[], when: Day, info?: ShowInfo) => {
      if (!keys.length) return;
      const it = tracked(target, info);
      const track = it.track!;
      const seen = { ...track.seen };
      for (const k of keys) seen[k] = seenDay(when);
      const next = { ...track, seen, status: track.status === 'paused' || track.status === 'dropped' ? 'watching' : track.status } as Track;
      save(it, next);
      const seasons = new Set(keys.map((k) => parseKey(k)?.season));
      const into = dayEntry(it, when, seasons.size === 1 ? [...seasons][0] : undefined);
      unlog(it, keys, into?.id);
      const episodes = [...new Set([...(into?.episodes ?? []), ...keys])];
      const stars = Object.fromEntries(keys.filter((k) => track.ratings?.[k]).map((k) => [k, track.ratings![k]]));
      const episodeRatings = { ...into?.episodeRatings, ...stars };
      const season = wholeSeason(episodes, next);
      if (into) updateEntry(into.id, { episodes, progress: progressLabel(episodes), episodeRatings, season: season ?? into.season });
      else logNew(it, when, { episodes, season, episodeRatings });
    },
    [tracked, save, dayEntry, unlog, updateEntry, logNew],
  );

  /**
   * A diary entry's date was changed (or set to "don't remember"): its episodes move to the new day on the
   * tracker, so Continue watching and the Episodes page show when you really saw them.
   */
  const redate = useCallback(
    (before: Pick<Entry, 'source' | 'sourceId' | 'title' | 'year' | 'episodes' | 'watchedOn' | 'undated'>, after: Day) => {
      const from = seenDay(before);
      const to = seenDay(after);
      if (from === to || !before.episodes?.length) return;
      const item = onWatchlist(before);
      if (!item?.track) return;
      updateWatchItem(item.id, { track: { ...item.track, seen: redated(item.track.seen, before.episodes, from, to) } });
    },
    [onWatchlist, updateWatchItem],
  );

  const setStatus = useCallback(
    (target: WatchItem | Title, status: TrackStatus, info?: ShowInfo) => {
      const it = tracked(target, info);
      updateWatchItem(it.id, { track: { ...it.track!, status } });
    },
    [tracked, updateWatchItem],
  );

  return { ensure, refresh, toggle, markMany, logSeason, logOn, rateEpisode, redate, setStatus };
}
