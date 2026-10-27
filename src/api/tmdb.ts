import type { Title } from '@/store/types';

// TMDB: free for non-commercial use with your own key (themoviedb.org/settings/api).
// Accepts either the short v3 "API key" or the long v4 "API Read Access Token".

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

/** The key to use: your own from Settings, else one baked in at build time (EXPO_PUBLIC_TMDB_KEY), else none. */
export function tmdbKey(userKey: string): string {
  return userKey.trim() || (process.env.EXPO_PUBLIC_TMDB_KEY ?? '').trim();
}

// TMDB's genre ids are fixed; search results only carry the ids.
const GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary', 18: 'Drama',
  10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western', 10759: 'Action & Adventure',
  10762: 'Kids', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics',
};

async function get<T>(key: string, path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const bearer = key.startsWith('eyJ');
  const query = new URLSearchParams({ language: 'en-US', ...params, ...(bearer ? {} : { api_key: key }) });
  const res = await fetch(`${BASE}${path}?${query}`, {
    signal,
    headers: { accept: 'application/json', ...(bearer ? { Authorization: `Bearer ${key}` } : {}) },
  });
  if (res.status === 401) throw new Error('TMDB didn’t accept your key. Check it in Settings.');
  if (!res.ok) throw new Error(`TMDB is having trouble (${res.status}). Try again in a moment.`);
  return (await res.json()) as T;
}

type Result = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview?: string;
  genre_ids?: number[];
};

const year = (date?: string) => (date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null);
export const poster = (path: string | null, size = 'w342') => (path ? `${IMG}/${size}${path}` : null);

function toTitle(r: Result, kind: 'movie' | 'tv'): Title {
  const title = (kind === 'movie' ? r.title : r.name) ?? '';
  const original = kind === 'movie' ? r.original_title : r.original_name;
  return {
    kind,
    source: 'tmdb',
    sourceId: `${kind}:${r.id}`,
    title,
    originalTitle: original && original !== title ? original : undefined,
    year: year(kind === 'movie' ? r.release_date : r.first_air_date),
    posterUrl: poster(r.poster_path),
    backdropUrl: poster(r.backdrop_path, 'w780'),
    overview: r.overview,
    genres: (r.genre_ids ?? []).map((id) => GENRES[id]).filter(Boolean),
    runtime: null,
  };
}

export async function searchTmdb(key: string, kind: 'movie' | 'tv', query: string, signal?: AbortSignal): Promise<Title[]> {
  const data = await get<{ results: Result[] }>(key, `/search/${kind}`, { query, include_adult: 'false' }, signal);
  return data.results.map((r) => toTitle(r, kind));
}

export async function trendingTmdb(key: string, kind: 'movie' | 'tv', signal?: AbortSignal): Promise<Title[]> {
  const data = await get<{ results: Result[] }>(key, `/trending/${kind}/week`, {}, signal);
  return data.results.map((r) => toTitle(r, kind));
}

type MovieDetails = Result & {
  runtime: number | null;
  genres: { name: string }[];
  credits?: { crew: { job: string; name: string }[] };
};
type TvDetails = Result & {
  episode_run_time: number[];
  genres: { name: string }[];
  number_of_episodes: number | null;
  networks: { name: string }[];
  created_by: { name: string }[];
};

/** Running time, full genres and director (films) or network (series). */
export async function detailsTmdb(key: string, t: Title, signal?: AbortSignal): Promise<Title> {
  const [kind, id] = t.sourceId.split(':') as ['movie' | 'tv', string];
  if (kind === 'movie') {
    const d = await get<MovieDetails>(key, `/movie/${id}`, { append_to_response: 'credits' }, signal);
    return {
      ...toTitle(d, 'movie'),
      genres: d.genres.map((g) => g.name),
      runtime: d.runtime || null,
      credit: d.credits?.crew.find((c) => c.job === 'Director')?.name ?? null,
    };
  }
  const d = await get<TvDetails>(key, `/tv/${id}`, {}, signal);
  return {
    ...toTitle(d, 'tv'),
    kind: t.kind,
    genres: d.genres.map((g) => g.name),
    runtime: d.episode_run_time?.[0] ?? null,
    episodes: d.number_of_episodes,
    credit: d.networks?.[0]?.name ?? d.created_by?.[0]?.name ?? null,
  };
}
