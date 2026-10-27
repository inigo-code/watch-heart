import type { Entry, MediaKind, WatchItem } from '@/store/types';

import { halfStars, hash, importedEntry, importedWatch, toDay } from './common';
import type { ImportResult } from './common';

// Trakt data export (trakt.tv → Settings → Data → Export). JSON files in Trakt's API shapes, recognised by
// their content rather than file names: watch history, ratings, watchlist, and "watched" summaries.
// Trakt includes TMDB ids, so titles match exactly. Moviebase syncs with Trakt, so this covers it too.

type Ids = { trakt?: number; tmdb?: number | null; imdb?: string | null; slug?: string };
type Media = { title?: string; year?: number | null; ids?: Ids };
type Item = {
  id?: number;
  type?: 'movie' | 'show' | 'episode' | 'season';
  watched_at?: string;
  rated_at?: string;
  listed_at?: string;
  last_watched_at?: string;
  rating?: number;
  plays?: number;
  movie?: Media;
  show?: Media;
  episode?: { season?: number; number?: number; title?: string };
};

export type TraktFile = 'history' | 'ratings' | 'watchlist' | 'watched';

/** What kind of Trakt export a JSON value is, or null when it isn't one. */
export function traktKind(json: unknown): TraktFile | null {
  if (!Array.isArray(json) || !json.length) return null;
  const first = json[0] as Item;
  if (!first || !(first.movie || first.show)) return null;
  if (first.watched_at) return 'history';
  if (first.rated_at && first.rating !== undefined) return 'ratings';
  if (first.listed_at) return 'watchlist';
  if (first.last_watched_at || first.plays !== undefined) return 'watched';
  return null;
}

const keyOf = (m: Media | undefined, type: 'movie' | 'tv') => `${type}:${m?.ids?.trakt ?? m?.ids?.tmdb ?? m?.title}`;

/** Exact TMDB link when Trakt has the id; the details are filled in by the next refresh. */
function tmdbFields(m: Media | undefined, type: 'movie' | 'tv') {
  return m?.ids?.tmdb ? { source: 'tmdb' as const, sourceId: `${type}:${m.ids.tmdb}`, fetchedAt: 0 } : {};
}

export function fromTrakt(files: Partial<Record<TraktFile, unknown[]>>): ImportResult {
  const entries: Entry[] = [];
  const ratingOf = new Map<string, number>();
  for (const r of (files.ratings ?? []) as Item[]) {
    if (r.type === 'movie') ratingOf.set(keyOf(r.movie, 'movie'), halfStars(r.rating, 10));
    if (r.type === 'show') ratingOf.set(keyOf(r.show, 'tv'), halfStars(r.rating, 10));
  }

  const history = (files.history ?? []) as Item[];
  // Films: one entry per viewing. Episodes: one entry per show per day.
  const days = new Map<string, { show: Media; day: string; episodes: { season?: number; number?: number }[]; at: string }>();
  for (const h of history) {
    const day = toDay(h.watched_at);
    if (!day) continue;
    if (h.type === 'movie' && h.movie?.title) {
      entries.push(
        importedEntry(`trakt-${h.id ?? hash(`${keyOf(h.movie, 'movie')}|${h.watched_at}`)}`, {
          kind: 'movie',
          title: h.movie.title,
          year: h.movie.year ?? null,
          watchedOn: day,
          imdbId: h.movie.ids?.imdb ?? null,
          createdAt: Date.parse(h.watched_at ?? '') || undefined,
          ...tmdbFields(h.movie, 'movie'),
        }),
      );
    } else if (h.type === 'episode' && h.show?.title) {
      const k = `${keyOf(h.show, 'tv')}|${day}`;
      const group = days.get(k) ?? { show: h.show, day, episodes: [], at: h.watched_at ?? '' };
      group.episodes.push(h.episode ?? {});
      days.set(k, group);
    }
  }
  for (const [k, g] of days) {
    const seasons = [...new Set(g.episodes.map((e) => e.season).filter((s) => s !== undefined))];
    const n = g.episodes.length;
    const progress =
      n === 1 && g.episodes[0].season !== undefined
        ? `S${g.episodes[0].season} · Ep ${g.episodes[0].number}`
        : `${seasons.length === 1 ? `Season ${seasons[0]} · ` : ''}${n} episodes`;
    entries.push(
      importedEntry(`trakt-ep-${hash(k)}`, {
        kind: 'tv',
        title: g.show.title ?? '',
        year: g.show.year ?? null,
        watchedOn: g.day,
        progress,
        imdbId: g.show.ids?.imdb ?? null,
        createdAt: Date.parse(g.at) || undefined,
        ...tmdbFields(g.show, 'tv'),
      }),
    );
  }

  // Without history, the "watched" summaries still say what was seen and when last.
  if (!history.length) {
    for (const w of (files.watched ?? []) as Item[]) {
      const media = w.movie ?? w.show;
      const type = w.movie ? 'movie' : 'tv';
      if (!media?.title) continue;
      entries.push(
        importedEntry(`trakt-w-${hash(keyOf(media, type))}`, {
          kind: type,
          title: media.title,
          year: media.year ?? null,
          watchedOn: toDay(w.last_watched_at),
          imdbId: media.ids?.imdb ?? null,
          ...tmdbFields(media, type),
        }),
      );
    }
  }

  // Ratings go on the most recent viewing of each title.
  const latest = new Map<string, Entry>();
  for (const e of entries) {
    const k = `${e.sourceId || e.title}|${e.kind}`;
    if (!latest.get(k) || latest.get(k)!.watchedOn < e.watchedOn) latest.set(k, e);
  }
  for (const r of (files.ratings ?? []) as Item[]) {
    const media = r.movie ?? r.show;
    const type = r.movie ? 'movie' : 'tv';
    const sid = media?.ids?.tmdb ? `${type}:${media.ids.tmdb}` : '';
    const target = [...latest.values()].find((e) => (sid ? e.sourceId === sid : e.title === media?.title && e.year === (media?.year ?? null)));
    if (target) target.rating = ratingOf.get(keyOf(media, type)) ?? target.rating;
  }

  const watchlist: WatchItem[] = ((files.watchlist ?? []) as Item[]).flatMap((w) => {
    const media = w.movie ?? w.show;
    const type: MediaKind = w.movie ? 'movie' : 'tv';
    if (!media?.title || (w.type !== 'movie' && w.type !== 'show')) return [];
    return [
      importedWatch(`traktw-${hash(keyOf(media, type))}`, {
        kind: type,
        title: media.title,
        year: media.year ?? null,
        imdbId: media.ids?.imdb ?? null,
        addedAt: Date.parse(w.listed_at ?? '') || Date.now(),
        ...tmdbFields(media, type),
      }),
    ];
  });

  return { entries, watchlist };
}
