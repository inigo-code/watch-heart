import type { Source } from '@/store/types';

import { tmdbKey } from './tmdb';

// Seasons and episodes for the tracker, from TMDB (with a key) or TVmaze (keyless).

export type Episode = { season: number; number: number; name: string; airDate: string | null; runtime: number | null };
export type ShowInfo = {
  seasons: { n: number; count: number; name: string }[];
  lastAired: { season: number; number: number } | null;
  nextAir: { season: number; number: number; date: string } | null;
  ended: boolean;
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

type MazeEpisode = { season: number; number: number | null; name: string; airdate: string; runtime: number | null };
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
    const d = await tmdbGet<{ episodes?: { episode_number: number; name: string; air_date: string | null; runtime: number | null }[] }>(
      tmdbKey(userKey),
      `/tv/${sourceId.split(':')[1]}/season/${season}`,
      signal,
    );
    list = (d.episodes ?? []).map((e) => ({ season, number: e.episode_number, name: e.name, airDate: e.air_date, runtime: e.runtime }));
  } else {
    list = (await mazeEpisodes(sourceId, signal))
      .filter((e) => e.season === season)
      .map((e) => ({ season, number: e.number!, name: e.name, airDate: e.airdate || null, runtime: e.runtime }));
  }
  seasonCache.set(cacheKey, list);
  return list;
}
