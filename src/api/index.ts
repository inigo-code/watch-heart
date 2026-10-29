import { MINUTE, cached } from '@/api/cache';
import { ANILIST_ALLOWED } from '@/lib/app';
import type { MediaKind, Title } from '@/store/types';

import { searchAnime, trendingAnime } from './anilist';
import { detailsTmdb, searchAnimeTmdb, searchTmdb, tmdbKey, trendingAnimeTmdb, trendingTmdb } from './tmdb';
import { popularTvmaze, searchTvmaze } from './tvmaze';

export { tmdbKey };

/**
 * Which free service answers each kind of search: TMDB whenever there's a key. Without one, series
 * come from TVmaze, and anime from AniList only with AniList's permission (see ANILIST_ALLOWED).
 */
export function sourceFor(kind: MediaKind, key: string): 'tmdb' | 'anilist' | 'tvmaze' | null {
  if (key) return 'tmdb';
  if (kind === 'anime') return ANILIST_ALLOWED ? 'anilist' : null;
  return kind === 'tv' ? 'tvmaze' : null;
}

export async function search(kind: MediaKind, query: string, key: string, signal?: AbortSignal): Promise<Title[]> {
  const source = sourceFor(kind, key);
  if (source === 'anilist') return searchAnime(query, signal);
  if (source === 'tvmaze') return searchTvmaze(query, signal);
  if (source === 'tmdb') return kind === 'anime' ? searchAnimeTmdb(key, query, signal) : searchTmdb(key, kind, query, signal);
  return [];
}

/** What's popular, shown before you type: trending this week (TMDB, AniList) or popular on TV today (TVmaze). Kept for 15 minutes. */
export function trending(kind: MediaKind, key: string, signal?: AbortSignal): Promise<Title[]> {
  void signal;
  return cached(`trending:${kind}:${sourceFor(kind, key)}`, 15 * MINUTE, () => loadTrending(kind, key));
}

async function loadTrending(kind: MediaKind, key: string, signal?: AbortSignal): Promise<Title[]> {
  const source = sourceFor(kind, key);
  if (source === 'anilist') return trendingAnime(signal);
  if (source === 'tmdb') return kind === 'anime' ? trendingAnimeTmdb(key, signal) : trendingTmdb(key, kind, signal);
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
