import { ANILIST_ALLOWED } from '@/lib/app';
import type { MediaKind, Title } from '@/store/types';

import { animeById } from './anilist';
import { findImdb, tmdbById } from './tmdb';
import { showById } from './tvmaze';

// Turns something shared to the app (a link from IMDb, Letterboxd, TMDB, AniList, MyAnimeList or
// TVmaze, or just a title) into the title to log, or else into a search to run.

export type Resolved = { title: Title } | { query: string; kind?: MediaKind };

const URL_RE = /https?:\/\/[^\s<>"]+/i;
// Words in film sites' paths that aren't the title.
const PATH_WORDS = /^(films?|title|anime|manga|shows?|movies?|tv|series|reviews?|watch)$/i;

/** The first link in shared text, if any. */
export function firstUrl(text: string): string | null {
  return text.match(URL_RE)?.[0]?.replace(/[).,]+$/, '') ?? null;
}

/** What to search for when a link can't be matched: the text around it, else words from the link's path. */
export function fallbackQuery(text: string, url: string | null, pageTitle?: string | null): string {
  const clean = (s: string) =>
    s
      .replace(new RegExp(URL_RE.source, 'gi'), ' ')
      // Drop the "⭐ 7.8 | Drama" kind of extras share sheets add, and a trailing (year).
      .split(/[|⭐★·•\n]/)[0]
      .replace(/\(\d{4}\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const fromText = clean(text);
  if (fromText) return fromText.slice(0, 80);
  if (pageTitle) return clean(pageTitle).slice(0, 80);
  if (!url) return '';
  try {
    // Only a readable slug helps ("666277-past-lives", "95396-severance", "Cowboy_Bebop"). Bare ids
    // (tt13238346), short-link codes (boxd.it/abc1) and the sites' own path words would search for gibberish.
    const { hostname, pathname } = new URL(url);
    if (hostname === 'boxd.it') return '';
    const slug = pathname
      .split('/')
      .filter(Boolean)
      .map((p) => decodeURIComponent(p).replace(/^\d+[-_]?/, ''))
      .find((p) => /[a-z]{3,}/i.test(p) && !PATH_WORDS.test(p) && !/^tt\d+$/.test(p));
    if (!slug) return '';
    return slug
      .replace(/[-_]+/g, ' ')
      .replace(/\b\d{4}\b$/, '')
      .trim();
  } catch {
    return '';
  }
}

/** Which site a link is from, and the id in it. Pure, so it's easy to check. */
export function parseLink(url: string):
  | { site: 'tmdb'; kind: 'movie' | 'tv'; id: string }
  | { site: 'imdb'; id: string }
  | { site: 'anilist'; id: number }
  | { site: 'mal'; id: number }
  | { site: 'tvmaze'; id: string }
  | { site: 'letterboxd' }
  | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, '');
  const path = u.pathname;
  let m: RegExpMatchArray | null;
  if (host === 'themoviedb.org' && (m = path.match(/^\/(movie|tv)\/(\d+)/))) return { site: 'tmdb', kind: m[1] as 'movie' | 'tv', id: m[2] };
  if (host === 'imdb.com' && (m = path.match(/\/title\/(tt\d+)/))) return { site: 'imdb', id: m[1] };
  if (host === 'anilist.co' && (m = path.match(/^\/anime\/(\d+)/))) return { site: 'anilist', id: Number(m[1]) };
  if (host === 'myanimelist.net' && (m = path.match(/^\/anime\/(\d+)/))) return { site: 'mal', id: Number(m[1]) };
  if (host === 'tvmaze.com' && (m = path.match(/^\/shows\/(\d+)/))) return { site: 'tvmaze', id: m[1] };
  if (host === 'letterboxd.com' || host === 'boxd.it') return { site: 'letterboxd' };
  return null;
}

/**
 * Letterboxd has no public API, but every film page names its TMDB id (data-tmdb-id) and its title.
 * Short boxd.it links redirect to the page, and fetch follows them.
 */
async function letterboxd(url: string, key: string, signal?: AbortSignal): Promise<Resolved | null> {
  try {
    const res = await fetch(url, { signal });
    const html = await res.text();
    const id = html.match(/data-tmdb-id="(\d+)"/)?.[1];
    const type = html.match(/data-tmdb-type="(movie|tv)"/)?.[1] as 'movie' | 'tv' | undefined;
    if (id && key) return { title: await tmdbById(key, type ?? 'movie', id, signal) };
    const og = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
    return og ? { query: fallbackQuery('', null, og.replace(/&#039;/g, "'").replace(/&amp;/g, '&')), kind: 'movie' } : null;
  } catch {
    return null;
  }
}

export async function resolveShared(text: string, key: string, signal?: AbortSignal): Promise<Resolved> {
  const url = firstUrl(text);
  const link = url ? parseLink(url) : null;
  try {
    if (link?.site === 'tmdb' && key) return { title: await tmdbById(key, link.kind, link.id, signal) };
    if (link?.site === 'imdb' && key) {
      const t = await findImdb(key, link.id, signal);
      if (t) return { title: t };
    }
    // AniList is only used with its permission; otherwise these links become a search by their title.
    if (ANILIST_ALLOWED && (link?.site === 'anilist' || link?.site === 'mal')) {
      const t = await animeById(link.site === 'anilist' ? { id: link.id } : { idMal: link.id }, signal);
      if (t) return { title: t };
    }
    if (link?.site === 'tvmaze') {
      const t = await showById(link.id, signal);
      if (t) return { title: t };
    }
    if (link?.site === 'letterboxd' && url) {
      const r = await letterboxd(url, key, signal);
      if (r) return r;
    }
  } catch {
    // Fall through to a search: better a search box than an error.
  }
  const kind: MediaKind | undefined =
    link?.site === 'anilist' || link?.site === 'mal' ? 'anime' : link?.site === 'tvmaze' ? 'tv' : link?.site === 'letterboxd' ? 'movie' : undefined;
  return { query: fallbackQuery(text, url), kind };
}
