import type { Title } from '@/store/types';

// TMDB: free for non-commercial use with your own key (themoviedb.org/settings/api).
// Accepts either the short v3 "API key" or the long v4 "API Read Access Token".

// TMDB's alternate API address. Some networks (several Indian ISPs among them) block
// api.themoviedb.org but not api.tmdb.org; posters on image.tmdb.org load either way.
const BASE = 'https://api.tmdb.org/3';
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

/** This week's trending films or series. Anime has its own tab, so it's left out here. */
export async function trendingTmdb(key: string, kind: 'movie' | 'tv', signal?: AbortSignal): Promise<Title[]> {
  const pages = await Promise.all(['1', '2'].map((page) => get<{ results: Result[] }>(key, `/trending/${kind}/week`, { page }, signal)));
  return pages
    .flatMap((p) => p.results.map((r) => toTitle(r, kind)))
    .filter((x) => x.kind !== 'anime')
    .slice(0, 20);
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

const KIDS = 10762;
const FAMILY = 10751;
const isoDaysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Anime people are watching now: this week's trending anime first, then popular anime airing this
 * fortnight. Long-running children's shows (always "airing", always popular) are left out of the second.
 */
export async function trendingAnimeTmdb(key: string, signal?: AbortSignal): Promise<Title[]> {
  type Page = { results: Result[] };
  const [tv1, tv2, films, airing] = await Promise.all([
    get<Page>(key, '/trending/tv/week', {}, signal),
    get<Page>(key, '/trending/tv/week', { page: '2' }, signal),
    get<Page>(key, '/trending/movie/week', {}, signal),
    get<Page>(
      key,
      '/discover/tv',
      {
        with_genres: String(ANIMATION),
        without_genres: `${KIDS},${FAMILY}`,
        with_original_language: 'ja',
        sort_by: 'popularity.desc',
        'air_date.gte': isoDaysFromNow(-14),
        'air_date.lte': isoDaysFromNow(7),
      },
      signal,
    ),
  ]);
  const seen = new Set<string>();
  const out: Title[] = [];
  const add = (r: Result, type: 'tv' | 'movie') => {
    if (!isAnime(r) || seen.has(`${type}:${r.id}`)) return;
    seen.add(`${type}:${r.id}`);
    out.push(toTitle(r, type));
  };
  for (const r of [...tv1.results, ...tv2.results]) add(r, 'tv');
  for (const r of films.results) add(r, 'movie');
  for (const r of airing.results) add(r, 'tv');
  return out.slice(0, 25);
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

const normTitle = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Finds the TMDB title for something imported or typed in by hand: exactly by IMDb id when known,
 * otherwise by name and year (trying films or series first by kind, then the other). A hit has to have
 * the same name, or be the right year, so a vague search doesn't attach the wrong poster. Null when unsure.
 */
export async function matchTmdb(
  key: string,
  t: { title: string; year: number | null; kind: Title['kind']; imdbId?: string | null },
  signal?: AbortSignal,
): Promise<Title | null> {
  if (t.imdbId) {
    const found = await findImdb(key, t.imdbId, signal);
    if (found) return found;
  }
  const want = normTitle(t.title);
  const pick = (hits: Title[]) => {
    const same = (h: Title) => normTitle(h.title) === want || (!!h.originalTitle && normTitle(h.originalTitle) === want);
    const near = (h: Title) => !!t.year && !!h.year && Math.abs(h.year - t.year) <= 1;
    return hits.find((h) => same(h) && near(h)) ?? hits.find((h) => same(h) && !t.year) ?? hits.find(same) ?? hits.find((h) => near(h) && normTitle(h.title).includes(want));
  };
  if (t.kind === 'anime') {
    const hit = pick(await searchAnimeTmdb(key, t.title, signal));
    if (hit) return tmdbById(key, hit.sourceId.startsWith('movie:') ? 'movie' : 'tv', hit.sourceId.split(':')[1], signal);
  }
  for (const type of t.kind === 'movie' ? (['movie', 'tv'] as const) : (['tv', 'movie'] as const)) {
    const hit = pick(await searchTmdb(key, type, t.title, signal, type === 'movie' ? (t.year ?? undefined) : undefined));
    if (hit) return tmdbById(key, type, hit.sourceId.split(':')[1], signal);
  }
  return null;
}

export type Provider = { id: number; name: string; logo: string };
export type WatchOptions = { link: string | null; stream: Provider[]; free: Provider[]; rent: Provider[]; buy: Provider[] };
export type TitleExtras = { score: number | null; votes: number; imdbId: string | null; watch: WatchOptions | null };

type ProviderRow = { provider_id: number; provider_name: string; logo_path: string | null; display_priority?: number };
type RegionProviders = { link?: string; flatrate?: ProviderRow[]; free?: ProviderRow[]; ads?: ProviderRow[]; rent?: ProviderRow[]; buy?: ProviderRow[] };

/**
 * TMDB's community score, the IMDb id and where to watch in one country, in one request. Streaming data
 * is JustWatch's, through TMDB; it has to be credited to JustWatch wherever it's shown.
 */
export async function extrasTmdb(key: string, sourceId: string, region: string, signal?: AbortSignal): Promise<TitleExtras> {
  const [type, id] = sourceId.split(':') as ['movie' | 'tv', string];
  const d = await get<{
    vote_average?: number;
    vote_count?: number;
    imdb_id?: string | null;
    external_ids?: { imdb_id?: string | null };
    'watch/providers'?: { results?: Record<string, RegionProviders> };
  }>(key, `/${type}/${id}`, { append_to_response: 'external_ids,watch/providers' }, signal);
  const r = d['watch/providers']?.results?.[region];
  const list = (rows?: ProviderRow[]) =>
    [...(rows ?? [])]
      .sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
      .map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path ? `${IMG}/w92${p.logo_path}` : '' }));
  return {
    score: d.vote_count ? Math.round((d.vote_average ?? 0) * 10) / 10 : null,
    votes: d.vote_count ?? 0,
    imdbId: d.imdb_id || d.external_ids?.imdb_id || null,
    watch: r ? { link: r.link ?? null, stream: list(r.flatrate), free: [...list(r.free), ...list(r.ads)], rent: list(r.rent), buy: list(r.buy) } : null,
  };
}
