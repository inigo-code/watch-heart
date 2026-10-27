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
