import { useCallback } from 'react';

import { showInfo } from '@/api/episodes';
import type { ShowInfo } from '@/api/episodes';
import { today } from '@/lib/dates';
import { epKey, newTrack, progressLabel, settle, withInfo } from '@/lib/tracking';
import { useSettings } from '@/settings/SettingsProvider';
import { titleOf, useDiary } from '@/store/DiaryStore';
import type { Title, Track, TrackStatus, WatchItem } from '@/store/types';

// What the tracker does to the diary:
// - Tracking a show keeps it on the watchlist (it shows under Continue watching, not Up next).
// - Ticking one episode logs it: today's diary entry for the show gains it ("S1 · Ep 3–4"), or a new
//   one is made. Unticking takes it out again (an entry left with nothing in it goes).
// - Catching up (a whole season, or "up to here") only marks episodes seen, without diary entries.

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

  const save = useCallback((item: WatchItem, track: Track) => updateWatchItem(item.id, { track: settle(track) }), [updateWatchItem]);

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
      const track = withInfo(item.track, info, Date.now());
      updateWatchItem(item.id, { track });
      return { info, track };
    },
    [settings.tmdbKey, updateWatchItem],
  );

  /** Today's tracker entry for this show, if there is one. */
  const todays = useCallback(
    (item: WatchItem) => entries.find((e) => e.episodes && e.watchedOn === today() && e.source === item.source && e.sourceId === item.sourceId),
    [entries],
  );

  const logEpisode = useCallback(
    (item: WatchItem, key: string, seen: boolean) => {
      const e = todays(item);
      if (seen) {
        const episodes = [...new Set([...(e?.episodes ?? []), key])];
        if (e) updateEntry(e.id, { episodes, progress: progressLabel(episodes) });
        else
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
            progress: progressLabel([key]),
            review: '',
            spoilers: false,
            tags: [],
            fetchedAt: item.fetchedAt ?? null,
            episodes: [key],
          });
      } else if (e) {
        const episodes = (e.episodes ?? []).filter((k) => k !== key);
        if (!episodes.length && !e.rating && !e.review.trim() && !e.liked) purgeEntry(e.id);
        else updateEntry(e.id, { episodes, progress: episodes.length ? progressLabel(episodes) : e.progress });
      }
    },
    [todays, addEntry, updateEntry, purgeEntry],
  );

  /** Ticks (or unticks) one episode and logs it in today's diary. */
  const toggle = useCallback(
    (target: WatchItem | Title, season: number, number: number, info?: ShowInfo) => {
      const it = tracked(target, info);
      const track = it.track!;
      const key = epKey(season, number);
      const seen = { ...track.seen };
      const now = !seen[key];
      if (now) seen[key] = today();
      else delete seen[key];
      save(it, { ...track, seen, status: track.status === 'paused' || track.status === 'dropped' ? 'watching' : track.status });
      logEpisode(it, key, now);
    },
    [tracked, save, logEpisode],
  );

  /** Marks several episodes seen (or not) at once, without diary entries: catching up. */
  const markMany = useCallback(
    (target: WatchItem | Title, keys: string[], seenNow: boolean, info?: ShowInfo) => {
      const it = tracked(target, info);
      const seen = { ...it.track!.seen };
      for (const k of keys) {
        if (seenNow) seen[k] = seen[k] ?? today();
        else delete seen[k];
      }
      save(it, { ...it.track!, seen });
    },
    [tracked, save],
  );

  const setStatus = useCallback(
    (target: WatchItem | Title, status: TrackStatus, info?: ShowInfo) => {
      const it = tracked(target, info);
      updateWatchItem(it.id, { track: { ...it.track!, status } });
    },
    [tracked, updateWatchItem],
  );

  return { ensure, refresh, toggle, markMany, setStatus };
}
