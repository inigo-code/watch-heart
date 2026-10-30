import { MINUTE, cached, cachedOnDisk } from '@/api/cache';
import type { MediaKind, Title } from '@/store/types';

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

/**
 * Every poster TMDB has for a title, to choose from: its own first, then English and textless ones, then
 * the title's own language, then the rest, the best rated first in each. Kept for an hour.
 */
export function postersTmdb(key: string, sourceId: string): Promise<{ main: string | null; posters: string[] }> {
  return cached(`posters:${sourceId}`, 60 * MINUTE, async () => {
    const [type, id] = sourceId.split(':');
    const kind = type === 'tv' ? 'tv' : 'movie';
    const [d, images] = await Promise.all([
      get<{ poster_path: string | null; original_language?: string }>(key, `/${kind}/${id}`),
      // No language: every poster, not only the English ones.
      get<{ posters: { file_path: string; iso_639_1: string | null; vote_average: number }[] }>(key, `/${kind}/${id}/images`, { language: '' }),
    ]);
    const rank = (lang: string | null) => (lang === 'en' ? 0 : lang === null ? 1 : lang === d.original_language ? 2 : 3);
    const sorted = [...images.posters].sort((a, b) => rank(a.iso_639_1) - rank(b.iso_639_1) || b.vote_average - a.vote_average);
    const paths = [...new Set([d.poster_path, ...sorted.map((p) => p.file_path)].filter((p): p is string => !!p))];
    return { main: poster(d.poster_path), posters: paths.map((p) => poster(p) as string) };
  });
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
/** A title's score, IMDb id and where to watch in a region; kept on the phone for 12 hours. */
export function extrasTmdb(key: string, sourceId: string, region: string, signal?: AbortSignal): Promise<TitleExtras> {
  void signal;
  return cachedOnDisk(`extras:${sourceId}:${region}`, 12 * 60 * MINUTE, () => loadExtras(key, sourceId, region));
}

async function loadExtras(key: string, sourceId: string, region: string, signal?: AbortSignal): Promise<TitleExtras> {
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

// ── The title page, people, and Discover ────────────────────────────────────────────────────────────

export type Person = { id: number; name: string; role: string; photo: string | null };
export type Season = { n: number; name: string; episodes: number; year: number | null; poster: string | null };
export type TitleAbout = {
  /** Full details: genres, running time, credit, episode count. */
  title: Title;
  tagline: string | null;
  overview: string;
  /** Series: Returning Series, Ended… */
  status: string | null;
  seasons: Season[];
  cast: Person[];
  crew: Person[];
  /** A YouTube video id. */
  trailer: string | null;
  recommendations: Title[];
  /** The director (films) or creators (series), for "By the same director". */
  makers: { id: number; name: string }[];
};

type Video = { key: string; site: string; type: string; official?: boolean };
type CastRow = { id: number; name: string; character?: string; roles?: { character: string; episode_count: number }[]; profile_path: string | null };
type CrewRow = { id: number; name: string; job?: string; jobs?: { job: string }[]; department: string; profile_path: string | null };
type Recommended = Result & { media_type?: 'movie' | 'tv' };

// The jobs worth showing on the crew row, in this order.
const KEY_JOBS = ['Director', 'Screenplay', 'Writer', 'Novel', 'Original Story', 'Story', 'Producer', 'Original Music Composer', 'Director of Photography', 'Editor'];

const pickTrailer = (videos?: { results: Video[] }) => {
  const yt = (videos?.results ?? []).filter((v) => v.site === 'YouTube');
  return (yt.find((v) => v.type === 'Trailer' && v.official) ?? yt.find((v) => v.type === 'Trailer') ?? yt.find((v) => v.type === 'Teaser'))?.key ?? null;
};

function crewOf(rows: CrewRow[], creators: { id: number; name: string; profile_path: string | null }[] = []): Person[] {
  const out: Person[] = creators.map((c) => ({ id: c.id, name: c.name, role: 'Creator', photo: poster(c.profile_path, 'w185') }));
  for (const job of KEY_JOBS) {
    for (const r of rows) {
      const jobs = r.job ? [r.job] : (r.jobs ?? []).map((j) => j.job);
      if (jobs.includes(job) && !out.some((p) => p.id === r.id)) {
        out.push({ id: r.id, name: r.name, role: job === 'Original Music Composer' ? 'Music' : job, photo: poster(r.profile_path, 'w185') });
      }
    }
  }
  return out;
}

/**
 * Everything the title page shows, in one request: details, cast and crew, trailer, recommendations. Kept
 * for the session, and shared while it loads: a title touched in a list starts loading before its page opens.
 * A screen that leaves doesn't cancel it, since another may be waiting on the same answer.
 */
export function aboutTmdb(key: string, sourceId: string, signal?: AbortSignal): Promise<TitleAbout> {
  void signal;
  return cached(`about:${sourceId}`, 12 * 60 * MINUTE, () => loadAbout(key, sourceId));
}

async function loadAbout(key: string, sourceId: string, signal?: AbortSignal): Promise<TitleAbout> {
  const [type, id] = sourceId.split(':') as ['movie' | 'tv', string];
  type Common = { tagline?: string; overview?: string; videos?: { results: Video[] }; recommendations?: { results: Recommended[] } };
  let about: TitleAbout;
  if (type === 'movie') {
    const d = await get<Omit<MovieDetails, 'credits'> & Common & { credits?: { cast: CastRow[]; crew: CrewRow[] } }>(
      key,
      `/movie/${id}`,
      { append_to_response: 'credits,videos,recommendations' },
      signal,
    );
    const base = toTitle(d, 'movie');
    const directors = (d.credits?.crew ?? []).filter((c) => c.job === 'Director');
    about = {
      title: {
        ...base,
        genres: d.genres.map((g) => g.name),
        runtime: d.runtime || null,
        credit: (base.kind === 'anime' ? d.production_companies?.[0]?.name : null) ?? directors[0]?.name ?? null,
      },
      tagline: d.tagline || null,
      overview: d.overview ?? '',
      status: null,
      seasons: [],
      cast: (d.credits?.cast ?? []).map((c) => ({ id: c.id, name: c.name, role: c.character ?? '', photo: poster(c.profile_path, 'w185') })),
      crew: crewOf(d.credits?.crew ?? []),
      trailer: pickTrailer(d.videos),
      recommendations: (d.recommendations?.results ?? []).map((r) => toTitle(r, r.media_type === 'tv' ? 'tv' : 'movie')),
      makers: directors.map((c) => ({ id: c.id, name: c.name })),
    };
  } else {
    const d = await get<
      Omit<TvDetails, 'created_by'> &
        Common & {
          status?: string;
          created_by: { id: number; name: string; profile_path: string | null }[];
          seasons?: { season_number: number; name: string; episode_count: number; air_date: string | null; poster_path: string | null }[];
          aggregate_credits?: { cast: CastRow[]; crew: CrewRow[] };
        }
    >(key, `/tv/${id}`, { append_to_response: 'aggregate_credits,videos,recommendations' }, signal);
    const base = toTitle(d, 'tv');
    about = {
      title: {
        ...base,
        genres: d.genres.map((g) => g.name),
        runtime: d.episode_run_time?.[0] ?? null,
        episodes: d.number_of_episodes,
        credit: (base.kind === 'anime' ? d.production_companies?.[0]?.name : null) ?? d.networks?.[0]?.name ?? d.created_by?.[0]?.name ?? null,
      },
      tagline: d.tagline || null,
      overview: d.overview ?? '',
      status: d.status ?? null,
      seasons: (d.seasons ?? [])
        .filter((s) => s.season_number > 0 && s.episode_count > 0)
        .map((s) => ({ n: s.season_number, name: s.name, episodes: s.episode_count, year: year(s.air_date ?? undefined), poster: poster(s.poster_path, 'w185') })),
      cast: (d.aggregate_credits?.cast ?? []).map((c) => ({ id: c.id, name: c.name, role: c.roles?.[0]?.character ?? '', photo: poster(c.profile_path, 'w185') })),
      crew: crewOf(d.aggregate_credits?.crew ?? [], d.created_by),
      trailer: pickTrailer(d.videos),
      recommendations: (d.recommendations?.results ?? []).map((r) => toTitle(r, r.media_type === 'movie' ? 'movie' : 'tv')),
      makers: (d.created_by ?? []).map((c) => ({ id: c.id, name: c.name })),
    };
  }
  return about;
}

type CreditRow = Result & { media_type: 'movie' | 'tv'; character?: string; job?: string; vote_count?: number };
export type PersonAbout = {
  id: number;
  name: string;
  photo: string | null;
  department: string | null;
  born: string | null;
  place: string | null;
  bio: string;
  /** Their titles, best known first: acting roles and crew jobs together, each title once. */
  credits: (Title & { role: string })[];
};

/** A person and what they've been in or made. */
export async function personTmdb(key: string, id: string, signal?: AbortSignal): Promise<PersonAbout> {
  const d = await get<{
    id: number;
    name: string;
    profile_path: string | null;
    known_for_department?: string;
    birthday?: string | null;
    place_of_birth?: string | null;
    biography?: string;
    combined_credits?: { cast: CreditRow[]; crew: CreditRow[] };
  }>(key, `/person/${id}`, { append_to_response: 'combined_credits' }, signal);
  const seen = new Map<string, Title & { role: string; votes: number }>();
  const rows = [
    ...(d.combined_credits?.cast ?? []).map((r) => ({ r, role: r.character ?? '' })),
    ...(d.combined_credits?.crew ?? []).map((r) => ({ r, role: r.job ?? '' })),
  ];
  for (const { r, role } of rows) {
    if (r.media_type !== 'movie' && r.media_type !== 'tv') continue;
    // Talk shows, news and reality, where people appear as themselves, crowd out the real work.
    if (r.media_type === 'tv' && r.genre_ids?.some((g) => g === 10767 || g === 10763 || g === 10764)) continue;
    const k = `${r.media_type}:${r.id}`;
    const prev = seen.get(k);
    if (prev) {
      if (role && !prev.role.split(', ').includes(role)) prev.role = prev.role ? `${prev.role}, ${role}` : role;
      continue;
    }
    seen.set(k, { ...toTitle(r, r.media_type), role, votes: r.vote_count ?? 0 });
  }
  return {
    id: d.id,
    name: d.name,
    photo: poster(d.profile_path, 'h632'),
    department: d.known_for_department ?? null,
    born: d.birthday ?? null,
    place: d.place_of_birth ?? null,
    bio: d.biography ?? '',
    credits: [...seen.values()].sort((a, b) => b.votes - a.votes).map(({ votes, ...t }) => (void votes, t)),
  };
}

/** A director's other films (or a creator's other series), best known first, leaving out this one. */
export async function madeBy(key: string, personId: number, type: 'movie' | 'tv', except: string, signal?: AbortSignal): Promise<Title[]> {
  const d = await get<{ crew: (Result & { job?: string; vote_count?: number })[] }>(key, `/person/${personId}/${type}_credits`, {}, signal);
  const jobs = type === 'movie' ? ['Director'] : ['Creator', 'Executive Producer'];
  const seen = new Set<number>();
  return d.crew
    .filter((r) => {
      if (!r.job || !jobs.includes(r.job) || `${type}:${r.id}` === except || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
    .slice(0, 20)
    .map((r) => toTitle(r, type));
}

/** The streaming services TMDB knows in a country, most watched there first (JustWatch's data). */
export function regionProviders(key: string, region: string, signal?: AbortSignal): Promise<Provider[]> {
  void signal;
  return cached(`providers:${region}`, 24 * 60 * MINUTE, () => loadProviders(key, region));
}

async function loadProviders(key: string, region: string, signal?: AbortSignal): Promise<Provider[]> {
  const d = await get<{ results: (ProviderRow & { display_priorities?: Record<string, number> })[] }>(key, '/watch/providers/movie', { watch_region: region }, signal);
  // Stores (rent or buy), kids' and ad-supported copies of a service aren't something to browse by.
  return d.results
    .filter((p) => !/store|kids|google play|amazon video|with ads|rakuten|channel/i.test(p.provider_name))
    .sort((a, b) => (a.display_priorities?.[region] ?? 999) - (b.display_priorities?.[region] ?? 999))
    .map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path ? `${IMG}/w92${p.logo_path}` : '' }));
}

/**
 * Genres to browse by, one list for films and series: TMDB numbers them separately and files some only one
 * way (series have no Horror; films have no Kids), so each has its film id, its series id, or both.
 */
export const BROWSE_GENRES: { name: string; movie?: number; tv?: number }[] = [
  { name: 'Action', movie: 28, tv: 10759 },
  { name: 'Adventure', movie: 12, tv: 10759 },
  { name: 'Animation', movie: 16, tv: 16 },
  { name: 'Comedy', movie: 35, tv: 35 },
  { name: 'Crime', movie: 80, tv: 80 },
  { name: 'Documentary', movie: 99, tv: 99 },
  { name: 'Drama', movie: 18, tv: 18 },
  { name: 'Family', movie: 10751, tv: 10751 },
  { name: 'Fantasy', movie: 14, tv: 10765 },
  { name: 'History', movie: 36 },
  { name: 'Horror', movie: 27 },
  { name: 'Kids', tv: 10762 },
  { name: 'Music', movie: 10402 },
  { name: 'Mystery', movie: 9648, tv: 9648 },
  { name: 'Reality', tv: 10764 },
  { name: 'Romance', movie: 10749 },
  { name: 'Science Fiction', movie: 878, tv: 10765 },
  { name: 'Thriller', movie: 53 },
  { name: 'War', movie: 10752, tv: 10768 },
  { name: 'Western', movie: 37, tv: 37 },
];
// Series-only names TMDB uses on title pages.
const GENRE_ALIASES: Record<string, string> = { 'Action & Adventure': 'Action', 'Sci-Fi & Fantasy': 'Science Fiction', 'War & Politics': 'War' };
export const browseGenre = (name: string) => BROWSE_GENRES.find((g) => g.name === (GENRE_ALIASES[name] ?? name));
/** TMDB's id for a genre when browsing this kind; undefined when TMDB doesn't file that kind under it. */
export const genreId = (name: string, kind: MediaKind) => browseGenre(name)?.[kind === 'movie' ? 'movie' : 'tv'];

export type BrowseSort = 'popular' | 'rating' | 'newest';
/** What to browse. Anime is Japanese animation, as series. */
export type BrowseQuery = {
  kind: MediaKind;
  /** BROWSE_GENRES names, all of which must match. */
  genres?: string[];
  /** BROWSE_GENRES names to leave out. */
  notGenres?: string[];
  /** TMDB keyword ids, any of which matches (christmas, new year's eve…). */
  keywords?: number[];
  /** Released from this year to this year, inclusive. */
  from?: number;
  to?: number;
  /** Or a window of days around today, e.g. [-45, 0] for the last six weeks. */
  days?: [number, number];
  /** Series with an episode out this fortnight. */
  airing?: boolean;
  lang?: string;
  /** Titles in this language first (on the first page), then the rest. Ignored when `lang` is set. */
  preferLang?: string;
  country?: string;
  provider?: number;
  region?: string;
  minScore?: number;
  minVotes?: number;
  maxVotes?: number;
  maxRuntime?: number;
  /** Series: 3 ended, 0 still running. */
  status?: number;
  /** Series: 2 miniseries. */
  tvType?: number;
  sort?: BrowseSort;
};

/** One page of titles matching a Discover query (kept for 15 minutes). */
export function discoverTmdb(key: string, q: BrowseQuery, page: number, signal?: AbortSignal): Promise<{ results: Title[]; pages: number }> {
  void signal;
  // The first page opens Home's and Discover's rows, so it's kept on the phone for two hours; later pages
  // only in memory.
  const id = `discover:${JSON.stringify(q)}:${page}`;
  return page === 1 ? cachedOnDisk(id, 120 * MINUTE, () => loadDiscover(key, q, page)) : cached(id, 15 * MINUTE, () => loadDiscover(key, q, page));
}

async function loadDiscover(key: string, q: BrowseQuery, page: number, signal?: AbortSignal): Promise<{ results: Title[]; pages: number }> {
  if (q.preferLang && !q.lang && q.kind !== 'anime' && page === 1) {
    const { preferLang, ...rest } = q;
    const [first, all] = await Promise.all([loadDiscover(key, { ...rest, lang: preferLang }, 1, signal), loadDiscover(key, rest, 1, signal)]);
    return { results: [...first.results, ...all.results.filter((t) => !first.results.some((f) => f.sourceId === t.sourceId))], pages: all.pages };
  }
  const type = q.kind === 'movie' ? 'movie' : 'tv';
  const dateField = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  const ids = (q.genres ?? []).map((g) => genreId(g, q.kind));
  // A genre TMDB doesn't use for this kind (Horror series) matches nothing, rather than everything.
  if (ids.some((id) => id === undefined)) return { results: [], pages: 0 };
  const genres = [...new Set([...(q.kind === 'anime' ? [ANIMATION] : []), ...(ids as number[])])];
  const p: Record<string, string> = { include_adult: 'false', page: String(page) };
  if (genres.length) p.with_genres = genres.join(',');
  if (q.keywords?.length) p.with_keywords = q.keywords.join('|');
  const without = (q.notGenres ?? []).map((g) => genreId(g, q.kind)).filter((id): id is number => id !== undefined);
  if (without.length) p.without_genres = without.join(',');
  if (q.kind === 'anime') p.with_original_language = 'ja';
  else if (q.lang) p.with_original_language = q.lang;
  if (q.country) p.with_origin_country = q.country;
  if (q.from) p[`${dateField}.gte`] = `${q.from}-01-01`;
  if (q.to) p[`${dateField}.lte`] = `${q.to}-12-31`;
  if (q.days) {
    p[`${dateField}.gte`] = isoDaysFromNow(q.days[0]);
    p[`${dateField}.lte`] = isoDaysFromNow(q.days[1]);
  }
  if (q.airing && type === 'tv') {
    p['air_date.gte'] = isoDaysFromNow(-14);
    p['air_date.lte'] = isoDaysFromNow(7);
    // Long-running children's shows are always airing and always popular.
    if (q.kind === 'anime') p.without_genres = [p.without_genres, KIDS, FAMILY].filter(Boolean).join(',');
  }
  if (q.provider && q.region) {
    p.with_watch_providers = String(q.provider);
    p.watch_region = q.region;
    p.with_watch_monetization_types = 'flatrate|free|ads';
  }
  if (q.minScore) p['vote_average.gte'] = String(q.minScore);
  // A rating sort with no floor is topped by titles with three votes. Titles out for a few weeks have few
  // votes yet, so a release window gets a lower floor (lowest for one country or language: new Indian films
  // have a handful; worldwide, a low floor lets in shorts with two perfect votes).
  const floor = !q.days ? 150 : q.country || q.lang ? 5 : 50;
  const minVotes = q.minVotes ?? (q.sort === 'rating' || q.minScore ? floor : undefined);
  if (minVotes) p['vote_count.gte'] = String(minVotes);
  if (q.maxVotes) p['vote_count.lte'] = String(q.maxVotes);
  if (q.maxRuntime) p['with_runtime.lte'] = String(q.maxRuntime);
  if (type === 'tv' && q.status !== undefined) p.with_status = String(q.status);
  if (type === 'tv' && q.tvType !== undefined) p.with_type = String(q.tvType);
  p.sort_by = q.sort === 'rating' ? 'vote_average.desc' : q.sort === 'newest' ? `${dateField}.desc` : 'popularity.desc';
  // Newest first would otherwise start with titles that haven't come out yet (this year's, or next week's).
  if (q.sort === 'newest') {
    const today = isoDaysFromNow(0);
    const lte = p[`${dateField}.lte`];
    if (!lte || lte > today) p[`${dateField}.lte`] = today;
  }
  const d = await get<{ results: Result[]; total_pages: number }>(key, `/discover/${type}`, p, signal);
  return { results: d.results.map((r) => toTitle(r, type)), pages: Math.min(d.total_pages, 500) };
}

/** This week's trending films and series together (anime included), most talked about first. Kept for an hour. */
export function trendingAllTmdb(key: string): Promise<Title[]> {
  return cachedOnDisk('trending:all', 60 * MINUTE, async () => {
    const d = await get<{ results: (Result & { media_type?: string })[] }>(key, '/trending/all/week');
    return d.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv').map((r) => toTitle(r, r.media_type as 'movie' | 'tv'));
  });
}

/** Films in cinemas in a country now, most popular first. Kept for six hours. */
export function nowPlayingTmdb(key: string, region: string): Promise<Title[]> {
  return cachedOnDisk(`now-playing:${region}`, 6 * 60 * MINUTE, async () => {
    const d = await get<{ results: Result[] }>(key, '/movie/now_playing', { region });
    return [...d.results].sort(byPopularity).map((r) => toTitle(r, 'movie'));
  });
}
