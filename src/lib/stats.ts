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

export function runtimeOf(e: Entry): number {
  if (!e.runtime) return 0;
  return e.kind === 'movie' ? e.runtime : e.runtime * episodesIn(e.progress);
}

export function computeStats(entries: Entry[]): Stats {
  const byKind: Record<MediaKind, number> = { movie: 0, tv: 0, anime: 0 };
  const ratings = new Array(11).fill(0) as number[];
  const genres = new Map<string, number>();
  let minutes = 0;
  let rated = 0;
  let ratingSum = 0;
  for (const e of entries) {
    byKind[e.kind]++;
    ratings[e.rating]++;
    if (e.rating) {
      rated++;
      ratingSum += e.rating;
    }
    minutes += runtimeOf(e);
    for (const g of e.genres) genres.set(g, (genres.get(g) ?? 0) + 1);
  }
  const favourite =
    [...entries].sort((a, b) => b.rating - a.rating || Number(b.liked) - Number(a.liked) || b.watchedOn.localeCompare(a.watchedOn))[0] ?? null;
  return {
    total: entries.length,
    byKind,
    avgStars: rated ? Math.round((ratingSum / rated / 2) * 10) / 10 : null,
    minutes,
    liked: entries.filter((e) => e.liked).length,
    rewatches: entries.filter((e) => e.rewatch).length,
    reviews: entries.filter((e) => e.review.trim()).length,
    topGenre: [...genres.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    ratings,
    favourite,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "12 films · 3 series · 2 anime", leaving out kinds with none. */
export function kindSummary(byKind: Record<MediaKind, number>): string {
  const parts = [];
  if (byKind.movie) parts.push(plural(byKind.movie, 'film', 'films'));
  if (byKind.tv) parts.push(plural(byKind.tv, 'series', 'series'));
  if (byKind.anime) parts.push(`${byKind.anime} anime`);
  return parts.join(' · ') || 'Nothing yet';
}

export const KIND_LABEL: Record<MediaKind, string> = { movie: 'Film', tv: 'Series', anime: 'Anime' };
