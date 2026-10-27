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
  original_language?: string;
  popularity?: number;
};

const year = (date?: string) => (date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null);
export const poster = (path: string | null, size = 'w342') => (path ? `${IMG}/${size}${path}` : null);

const ANIMATION = 16;

/** Japanese animation: TMDB files anime as Animation with Japanese as the original language. */
function isAnime(r: Result & { genres?: { id: number }[] }) {
  return r.original_language === 'ja' && (r.genre_ids?.includes(ANIMATION) || r.genres?.some((g) => g.id === ANIMATION) === true);
}

function toTitle(r: Result & { genres?: { id: number }[] }, type: 'movie' | 'tv'): Title {
  const title = (type === 'movie' ? r.title : r.name) ?? '';
  const original = type === 'movie' ? r.original_title : r.original_name;
  return {
    kind: isAnime(r) ? 'anime' : type,
    source: 'tmdb',
    sourceId: `${type}:${r.id}`,
    title,
    originalTitle: original && original !== title ? original : undefined,
    year: year(type === 'movie' ? r.release_date : r.first_air_date),
    posterUrl: poster(r.poster_path),
    backdropUrl: poster(r.backdrop_path, 'w780'),
    overview: r.overview,
    genres: (r.genre_ids ?? []).map((id) => GENRES[id]).filter(Boolean),
    runtime: null,
  };
}

/** Searches films or series; `year` narrows a film search to that release year. */
export async function searchTmdb(key: string, kind: 'movie' | 'tv', query: string, signal?: AbortSignal, year?: number): Promise<Title[]> {
  const params = { query, include_adult: 'false', ...(year && kind === 'movie' ? { year: String(year) } : {}) };
  const data = await get<{ results: Result[] }>(key, `/search/${kind}`, params, signal);
  return data.results.map((r) => toTitle(r, kind));
}

export async function trendingTmdb(key: string, kind: 'movie' | 'tv', signal?: AbortSignal): Promise<Title[]> {
  const data = await get<{ results: Result[] }>(key, `/trending/${kind}/week`, {}, signal);
  return data.results.map((r) => toTitle(r, kind));
}

const byPopularity = (a: Result, b: Result) => (b.popularity ?? 0) - (a.popularity ?? 0);

/** Anime series and films matching the search, most popular first. */
export async function searchAnimeTmdb(key: string, query: string, signal?: AbortSignal): Promise<Title[]> {
  const params = { query, include_adult: 'false' };
  const [tv, movie] = await Promise.all([
    get<{ results: Result[] }>(key, '/search/tv', params, signal),
    get<{ results: Result[] }>(key, '/search/movie', params, signal),
  ]);
  const hits: [Result, 'tv' | 'movie'][] = [...tv.results.map((r) => [r, 'tv'] as [Result, 'tv']), ...movie.results.map((r) => [r, 'movie'] as [Result, 'movie'])];
  return hits
    .filter(([r]) => isAnime(r))
    .sort(([a], [b]) => byPopularity(a, b))
    .map(([r, type]) => toTitle(r, type));
}

/** The most popular anime right now: series first, with the biggest films mixed in. */
export async function trendingAnimeTmdb(key: string, signal?: AbortSignal): Promise<Title[]> {
  const params = { with_genres: String(ANIMATION), with_original_language: 'ja', sort_by: 'popularity.desc', include_adult: 'false' };
  const [tv, movie] = await Promise.all([
    get<{ results: Result[] }>(key, '/discover/tv', params, signal),
    get<{ results: Result[] }>(key, '/discover/movie', params, signal),
  ]);
  return [...tv.results.slice(0, 18).map((r) => toTitle(r, 'tv')), ...movie.results.slice(0, 7).map((r) => toTitle(r, 'movie'))];
}

type MovieDetails = Result & {
  runtime: number | null;
  genres: { id: number; name: string }[];
  production_companies?: { name: string }[];
  credits?: { crew: { job: string; name: string }[] };
};
type TvDetails = Result & {
  episode_run_time: number[];
  genres: { id: number; name: string }[];
  production_companies?: { name: string }[];
  number_of_episodes: number | null;
  networks: { name: string }[];
  created_by: { name: string }[];
};

/** Running time, full genres, and director (films), studio (anime) or network (series). */
export async function detailsTmdb(key: string, t: Title, signal?: AbortSignal): Promise<Title> {
  const [kind, id] = t.sourceId.split(':') as ['movie' | 'tv', string];
  if (kind === 'movie') {
    const d = await get<MovieDetails>(key, `/movie/${id}`, { append_to_response: 'credits' }, signal);
    const base = toTitle(d, 'movie');
    return {
      ...base,
      genres: d.genres.map((g) => g.name),
      runtime: d.runtime || null,
      credit: (base.kind === 'anime' ? d.production_companies?.[0]?.name : null) ?? d.credits?.crew.find((c) => c.job === 'Director')?.name ?? null,
    };
  }
  const d = await get<TvDetails>(key, `/tv/${id}`, {}, signal);
  const base = toTitle(d, 'tv');
  return {
    ...base,
    genres: d.genres.map((g) => g.name),
    runtime: d.episode_run_time?.[0] ?? null,
    episodes: d.number_of_episodes,
    credit: (base.kind === 'anime' ? d.production_companies?.[0]?.name : null) ?? d.networks?.[0]?.name ?? d.created_by?.[0]?.name ?? null,
  };
}

/** A film or series by its TMDB id, with full details. */
export function tmdbById(key: string, kind: 'movie' | 'tv', id: string, signal?: AbortSignal): Promise<Title> {
  const stub: Title = { kind, source: 'tmdb', sourceId: `${kind}:${id}`, title: '', year: null, posterUrl: null, backdropUrl: null, genres: [], runtime: null };
  return detailsTmdb(key, stub, signal);
}

/** Looks up an IMDb id (tt1234567) on TMDB; null when TMDB doesn't know it. */
export async function findImdb(key: string, imdbId: string, signal?: AbortSignal): Promise<Title | null> {
  const data = await get<{ movie_results: Result[]; tv_results: Result[] }>(key, `/find/${imdbId}`, { external_source: 'imdb_id' }, signal);
  const movie = data.movie_results[0];
  if (movie) return tmdbById(key, 'movie', String(movie.id), signal);
  const tv = data.tv_results[0];
  return tv ? tmdbById(key, 'tv', String(tv.id), signal) : null;
}
