import type { Entry, MediaKind } from '@/store/types';

export type Stats = {
  total: number;
  byKind: Record<MediaKind, number>;
  /** Average of rated entries, in stars (0.5–5), or null when nothing is rated. */
  avgStars: number | null;
  /** Minutes watched, counting what's known (a film's running time; one episode for a series unless the progress says more). */
  minutes: number;
  liked: number;
  rewatches: number;
  reviews: number;
  topGenre: string | null;
  /** The vibe picked most often, from "more about this viewing". */
  topVibe: string | null;
  /** Count of entries at each half-star rating, index 1–10 (index 0 = unrated). */
  ratings: number[];
  /** Highest rated, ties broken by liked, then most recent. */
  favourite: Entry | null;
};

/** Episodes counted from a progress note like "Ep 1–12", "Episodes 13-24" or "12 eps". */
export function episodesIn(progress: string): number {
  const range = progress.match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (range) return Math.max(1, Number(range[2]) - Number(range[1]) + 1);
  const count = progress.match(/(\d+)\s*(?:eps?|episodes?)\b/i);
  return count ? Number(count[1]) : 1;
}

/** Episodes in a viewing: the ticked ones when it has them, otherwise what the progress note says. */
export const episodesOf = (e: Pick<Entry, 'episodes' | 'progress'>) => e.episodes?.length || episodesIn(e.progress);

export function runtimeOf(e: Entry): number {
  if (!e.runtime) return 0;
  return e.kind === 'movie' ? e.runtime : e.runtime * episodesOf(e);
}

/** One key per title, however many entries (episodes, rewatches) it has. */
export const titleKey = (e: Pick<Entry, 'source' | 'sourceId' | 'kind' | 'title'>) =>
  e.source !== 'manual' && e.sourceId ? `${e.source}:${e.sourceId}` : `${e.kind}:${e.title}`;

/**
 * One entry per title, for a recap story: a show logged an episode at a time shows once. It keeps the
 * first entry's id and day, the best rating, a heart if any had one, and, for a series or anime logged
 * more than once, the episodes added up.
 */
export function oneEach(entries: Entry[]): Entry[] {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = titleKey(e);
    const group = groups.get(key);
    if (group) group.push(e);
    else groups.set(key, [e]);
  }
  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    const byDay = [...group].sort((a, b) => a.watchedOn.localeCompare(b.watchedOn) || a.createdAt - b.createdAt);
    const first = byDay[0];
    const best = [...group].sort((a, b) => b.rating - a.rating || b.watchedOn.localeCompare(a.watchedOn))[0];
    const eps = group.reduce((n, e) => n + episodesOf(e), 0);
    return {
      ...best,
      id: first.id,
      watchedOn: first.watchedOn,
      createdAt: first.createdAt,
      liked: group.some((e) => e.liked),
      rewatch: group.some((e) => e.rewatch),
      progress: first.kind === 'movie' ? best.progress : `${eps} ${eps === 1 ? 'episode' : 'episodes'}`,
      posterUrl: best.posterUrl ?? group.find((e) => e.posterUrl)?.posterUrl ?? null,
    };
  });
}

export function computeStats(entries: Entry[]): Stats {
  const byKind: Record<MediaKind, number> = { movie: 0, tv: 0, anime: 0 };
  const counted = new Set<string>();
  const ratings = new Array(11).fill(0) as number[];
  const genres = new Map<string, number>();
  const vibes = new Map<string, number>();
  let minutes = 0;
  let rated = 0;
  let ratingSum = 0;
  for (const e of entries) {
    const title = titleKey(e);
    if (!counted.has(title)) {
      counted.add(title);
      byKind[e.kind]++;
    }
    ratings[e.rating]++;
    if (e.rating) {
      rated++;
      ratingSum += e.rating;
    }
    minutes += runtimeOf(e);
    for (const g of e.genres) genres.set(g, (genres.get(g) ?? 0) + 1);
    for (const v of e.vibes ?? []) vibes.set(v, (vibes.get(v) ?? 0) + 1);
  }
  const favourite =
    [...entries].sort((a, b) => b.rating - a.rating || Number(b.liked) - Number(a.liked) || b.watchedOn.localeCompare(a.watchedOn))[0] ?? null;
  return {
    total: counted.size,
    byKind,
    avgStars: rated ? Math.round((ratingSum / rated / 2) * 10) / 10 : null,
    minutes,
    liked: entries.filter((e) => e.liked).length,
    rewatches: entries.filter((e) => e.rewatch).length,
    reviews: entries.filter((e) => e.review.trim()).length,
    topGenre: [...genres.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    topVibe: [...vibes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    ratings,
    favourite,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "12 films, 3 series and 2 anime", leaving out kinds with none. */
export function kindSummary(byKind: Record<MediaKind, number>): string {
  const parts = [];
  if (byKind.movie) parts.push(plural(byKind.movie, 'film', 'films'));
  if (byKind.tv) parts.push(plural(byKind.tv, 'series', 'series'));
  if (byKind.anime) parts.push(`${byKind.anime} anime`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || 'Nothing yet';
}

export const KIND_LABEL: Record<MediaKind, string> = { movie: 'Film', tv: 'Series', anime: 'Anime' };

/** The day with the most viewings, if any day had more than one. */
export function busiestDay(entries: Entry[]): { day: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.watchedOn, (counts.get(e.watchedOn) ?? 0) + 1);
  let best: { day: string; count: number } | null = null;
  for (const [day, count] of counts) {
    if (count > 1 && (!best || count > best.count || (count === best.count && day < best.day))) best = { day, count };
  }
  return best;
}
