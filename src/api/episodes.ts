import type { Source } from '@/store/types';

import { tmdbKey } from './tmdb';

// Seasons and episodes for the tracker, from TMDB (with a key) or TVmaze (keyless).

export type Episode = {
  season: number;
  number: number;
  name: string;
  airDate: string | null;
  runtime: number | null;
  overview: string;
  still: string | null;
  /** The audience score out of 10, when there is one. */
  score: number | null;
  director: string | null;
};
/** An episode to come. `date` is your local day when the exact moment (`at`) is known. */
export type Coming = { season: number; number: number; date: string; at?: string };
export type ShowInfo = {
  seasons: { n: number; count: number; name: string }[];
  lastAired: { season: number; number: number } | null;
  nextAir: { season: number; number: number; date: string } | null;
  ended: boolean;
  upcoming?: Coming[];
};

const TMDB = 'https://api.tmdb.org/3';
const TVMAZE = 'https://api.tvmaze.com';

async function tmdbGet<T>(key: string, path: string, signal?: AbortSignal): Promise<T> {
  const bearer = key.startsWith('eyJ');
  const q = new URLSearchParams({ language: 'en-US', ...(bearer ? {} : { api_key: key }) });
  const res = await fetch(`${TMDB}${path}?${q}`, { signal, headers: bearer ? { Authorization: `Bearer ${key}` } : {} });
  if (!res.ok) throw new Error(`TMDB is having trouble (${res.status}).`);
  return res.json() as Promise<T>;
}

async function mazeGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${TVMAZE}${path}`, { signal });
  if (!res.ok) throw new Error(`TVmaze is having trouble (${res.status}).`);
  return res.json() as Promise<T>;
}

/** Whether a title can be tracked episode by episode (a series on TMDB or TVmaze). */
export const trackable = (t: { source: Source; sourceId: string }) => (t.source === 'tmdb' && t.sourceId.startsWith('tv:')) || t.source === 'tvmaze';

type MazeEpisode = {
  season: number;
  number: number | null;
  name: string;
  airdate: string;
  /** Blank for most streaming shows, whose airstamp is then only a placeholder. */
  airtime?: string;
  airstamp?: string | null;
  runtime: number | null;
  summary?: string | null;
  image?: { medium?: string } | null;
  rating?: { average?: number | null };
};
const mazeCache = new Map<string, MazeEpisode[]>();
async function mazeEpisodes(id: string, signal?: AbortSignal) {
  if (!mazeCache.has(id)) mazeCache.set(id, (await mazeGet<MazeEpisode[]>(`/shows/${id}/episodes`, signal)).filter((e) => e.number !== null));
  return mazeCache.get(id)!;
}

export async function showInfo(userKey: string, source: Source, sourceId: string, signal?: AbortSignal): Promise<ShowInfo> {
  if (source === 'tmdb') {
    const id = sourceId.split(':')[1];
    const d = await tmdbGet<{
      status?: string;
      seasons?: { season_number: number; episode_count: number; name: string }[];
      last_episode_to_air?: { season_number: number; episode_number: number } | null;
      next_episode_to_air?: { season_number: number; episode_number: number; air_date: string | null } | null;
    }>(tmdbKey(userKey), `/tv/${id}`, signal);
    const next = d.next_episode_to_air;
    return {
      seasons: (d.seasons ?? []).filter((x) => x.season_number > 0 && x.episode_count > 0).map((x) => ({ n: x.season_number, count: x.episode_count, name: x.name })),
      lastAired: d.last_episode_to_air ? { season: d.last_episode_to_air.season_number, number: d.last_episode_to_air.episode_number } : null,
      nextAir: next?.air_date ? { season: next.season_number, number: next.episode_number, date: next.air_date } : null,
      ended: d.status === 'Ended' || d.status === 'Canceled',
    };
  }
  const [show, eps] = await Promise.all([mazeGet<{ status?: string }>(`/shows/${sourceId}`, signal), mazeEpisodes(sourceId, signal)]);
  const today = new Date().toISOString().slice(0, 10);
  const counts = new Map<number, number>();
  for (const e of eps) counts.set(e.season, Math.max(counts.get(e.season) ?? 0, e.number ?? 0));
  const aired = eps.filter((e) => e.airdate && e.airdate <= today);
  const last = aired[aired.length - 1];
  const next = eps.find((e) => e.airdate && e.airdate > today);
  return {
    seasons: [...counts.entries()].filter(([n]) => n > 0).map(([n, count]) => ({ n, count, name: `Season ${n}` })),
    lastAired: last ? { season: last.season, number: last.number! } : null,
    nextAir: next ? { season: next.season, number: next.number!, date: next.airdate } : null,
    ended: show.status === 'Ended',
  };
}

const seasonCache = new Map<string, Episode[]>();

/** One season's episodes, with names and air dates. */
export async function seasonEpisodes(userKey: string, source: Source, sourceId: string, season: number, signal?: AbortSignal): Promise<Episode[]> {
  const cacheKey = `${source}:${sourceId}:${season}`;
  if (seasonCache.has(cacheKey)) return seasonCache.get(cacheKey)!;
  let list: Episode[];
  if (source === 'tmdb') {
    const d = await tmdbGet<{
      episodes?: {
        episode_number: number;
        name: string;
        air_date: string | null;
        runtime: number | null;
        overview?: string;
        still_path?: string | null;
        vote_average?: number;
        vote_count?: number;
        crew?: { job?: string; name?: string }[];
      }[];
    }>(
      tmdbKey(userKey),
      `/tv/${sourceId.split(':')[1]}/season/${season}`,
      signal,
    );
    list = (d.episodes ?? []).map((e) => ({
      season,
      number: e.episode_number,
      name: e.name,
      airDate: e.air_date,
      runtime: e.runtime,
      overview: e.overview ?? '',
      still: e.still_path ? `https://image.tmdb.org/t/p/w500${e.still_path}` : null,
      score: e.vote_count ? (e.vote_average ?? null) : null,
      director: e.crew?.find((c) => c.job === 'Director')?.name ?? null,
    }));
  } else {
    list = (await mazeEpisodes(sourceId, signal))
      .filter((e) => e.season === season)
      .map((e) => ({
        season,
        number: e.number!,
        name: e.name,
        airDate: e.airdate || null,
        runtime: e.runtime,
        overview: (e.summary ?? '').replace(/<[^>]+>/g, '').trim(),
        still: e.image?.medium ?? null,
        score: e.rating?.average ?? null,
        director: null,
      }));
  }
  seasonCache.set(cacheKey, list);
  return list;
}

const mazeIds = new Map<string, string | null>();

/** TVmaze's id for a show, which is how an exact air time is found for a TMDB title. */
async function mazeIdFor(userKey: string, source: Source, sourceId: string, signal?: AbortSignal) {
  if (source === 'tvmaze') return sourceId;
  const id = sourceId.split(':')[1];
  if (mazeIds.has(id)) return mazeIds.get(id)!;
  const ids = await tmdbGet<{ tvdb_id?: number | null; imdb_id?: string | null }>(tmdbKey(userKey), `/tv/${id}/external_ids`, signal);
  let found: string | null = null;
  for (const q of [ids.tvdb_id ? `thetvdb=${ids.tvdb_id}` : '', ids.imdb_id ? `imdb=${ids.imdb_id}` : '']) {
    if (!q) continue;
    const res = await fetch(`${TVMAZE}/lookup/shows?${q}`, { signal });
    if (res.ok) {
      found = String(((await res.json()) as { id: number }).id);
      break;
    }
  }
  mazeIds.set(id, found);
  return found;
}

const DAY = 24 * 60 * 60 * 1000;

function localDay(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The rest of the airing season, fresh. Exact times come from TVmaze: only when it really has one, and only
 * when its episode falls on about the same day, since the two sites can number a show differently.
 */
export async function comingEpisodes(userKey: string, source: Source, sourceId: string, next: { season: number; number: number }, signal?: AbortSignal): Promise<Coming[]> {
  seasonCache.delete(`${source}:${sourceId}:${next.season}`);
  const season = await seasonEpisodes(userKey, source, sourceId, next.season, signal);
  const timed = await mazeIdFor(userKey, source, sourceId, signal)
    .then(async (id) => {
      if (!id) return [];
      mazeCache.delete(id);
      return mazeEpisodes(id, signal);
    })
    .catch(() => [] as MazeEpisode[]);
  return season.flatMap((e) => {
    if (!e.airDate || e.number < next.number) return [];
    const maze = timed.find((m) => m.season === e.season && m.number === e.number);
    const near = maze?.airdate && Math.abs(Date.parse(maze.airdate) - Date.parse(e.airDate)) <= DAY;
    const at = near && maze.airtime ? maze.airstamp : null;
    return [at ? { season: e.season, number: e.number, date: localDay(at), at } : { season: e.season, number: e.number, date: e.airDate }];
  });
}
