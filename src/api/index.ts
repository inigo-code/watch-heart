import type { MediaKind, Title } from '@/store/types';

import { searchAnime, trendingAnime } from './anilist';
import { detailsTmdb, searchTmdb, tmdbKey, trendingTmdb } from './tmdb';
import { popularTvmaze, searchTvmaze } from './tvmaze';

export { tmdbKey };

/** Which free service answers each kind of search, given whether a TMDB key is set. */
export function sourceFor(kind: MediaKind, key: string): 'tmdb' | 'anilist' | 'tvmaze' | null {
  if (kind === 'anime') return 'anilist';
  if (key) return 'tmdb';
  return kind === 'tv' ? 'tvmaze' : null;
}

export async function search(kind: MediaKind, query: string, key: string, signal?: AbortSignal): Promise<Title[]> {
  const source = sourceFor(kind, key);
  if (source === 'anilist') return searchAnime(query, signal);
  if (source === 'tvmaze') return searchTvmaze(query, signal);
  if (source === 'tmdb') return searchTmdb(key, kind as 'movie' | 'tv', query, signal);
  return [];
}

/** What's popular, shown before you type: trending this week (TMDB, AniList) or popular on TV today (TVmaze). */
export async function trending(kind: MediaKind, key: string, signal?: AbortSignal): Promise<Title[]> {
  const source = sourceFor(kind, key);
  if (source === 'anilist') return trendingAnime(signal);
  if (source === 'tmdb') return trendingTmdb(key, kind as 'movie' | 'tv', signal);
  if (source === 'tvmaze') return popularTvmaze(signal);
  return [];
}

/** Fills in running time, genres and credits where search results leave them out (TMDB only). */
export async function details(t: Title, key: string, signal?: AbortSignal): Promise<Title> {
  if (t.source !== 'tmdb' || !key) return t;
  try {
    return { ...t, ...(await detailsTmdb(key, t, signal)), kind: t.kind };
  } catch {
    return t;
  }
}
