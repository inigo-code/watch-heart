import { today } from '@/lib/dates';
import type { Title } from '@/store/types';

// TVmaze: free, no key. Used for series when there's no TMDB key. Data is CC BY-SA.

type Show = {
  id: number;
  name: string;
  premiered: string | null;
  image: { medium: string; original: string } | null;
  summary: string | null;
  genres: string[];
  runtime: number | null;
  averageRuntime: number | null;
  network: { name: string } | null;
  webChannel: { name: string } | null;
  /** TVmaze's popularity score, 0–100. */
  weight?: number;
  /** Scripted, Reality, Animation, Talk Show, News… */
  type?: string;
};

const plain = (s: string | null) => (s ?? '').replace(/<[^>]+>/g, '').trim();

function toTitle(s: Show): Title {
  return {
    kind: 'tv',
    source: 'tvmaze',
    sourceId: String(s.id),
    title: s.name,
    year: s.premiered ? Number(s.premiered.slice(0, 4)) : null,
    posterUrl: s.image?.medium ?? null,
    backdropUrl: s.image?.original ?? null,
    overview: plain(s.summary),
    genres: s.genres,
    runtime: s.runtime ?? s.averageRuntime,
    credit: s.network?.name ?? s.webChannel?.name ?? null,
  };
}

export async function searchTvmaze(query: string, signal?: AbortSignal): Promise<Title[]> {
  const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error(`TVmaze is having trouble (${res.status}). Try again in a moment.`);
  const json = (await res.json()) as { show: Show }[];
  return json.map((r) => toTitle(r.show));
}

/** One series by its TVmaze id; null when there's no such show. */
export async function showById(id: string, signal?: AbortSignal): Promise<Title | null> {
  const res = await fetch(`https://api.tvmaze.com/shows/${encodeURIComponent(id)}`, { signal });
  return res.ok ? toTitle((await res.json()) as Show) : null;
}

// Kinds of show that fill the schedule every day but aren't what people come to log.
const NOT_POPULAR_PICKS = new Set(['Talk Show', 'News', 'Sports', 'Panel Show', 'Award Show']);
let popularCache: { date: string; titles: Title[] } | null = null;

/**
 * TVmaze has no trending list, so this is the next best thing: what airs today on streaming services
 * and US networks, most popular first (by TVmaze's own score). Fetched once a day.
 */
export async function popularTvmaze(signal?: AbortSignal): Promise<Title[]> {
  const date = today();
  if (popularCache?.date === date) return popularCache.titles;
  const get = async (path: string) => {
    const res = await fetch(`https://api.tvmaze.com/${path}`, { signal });
    if (!res.ok) throw new Error(`TVmaze is having trouble (${res.status}). Try again in a moment.`);
    return (await res.json()) as { show?: Show; _embedded?: { show?: Show } }[];
  };
  const [streaming, network] = await Promise.all([get(`schedule/web?date=${date}`), get(`schedule?date=${date}&country=US`)]);
  const shows = new Map<number, Show>();
  for (const e of [...streaming, ...network]) {
    const show = e.show ?? e._embedded?.show;
    if (show?.image && !NOT_POPULAR_PICKS.has(show.type ?? '')) shows.set(show.id, show);
  }
  const titles = [...shows.values()].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 30).map(toTitle);
  popularCache = { date, titles };
  return titles;
}
