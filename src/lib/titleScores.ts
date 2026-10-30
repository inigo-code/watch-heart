import { cached, MINUTE } from '@/api/cache';
import { tmdbKey } from '@/api';
import { omdbByTitle, omdbKey as omdbKeyFor, omdbRatings, watchRegion } from '@/api/omdb';
import type { OmdbRatings } from '@/api/omdb';
import { extrasTmdb } from '@/api/tmdb';
import type { TitleExtras } from '@/api/tmdb';

/**
 * A title's scores and where to watch, in one place, so they can start loading the moment a poster is
 * touched (warmTitle) and the title page finds them ready. Where to watch is kept on the phone for 12
 * hours (extrasTmdb), OMDb's scores for a day (omdb.ts), and the answer here for the session.
 */
export type TitleScores = { extras: TitleExtras | null; omdb: OmdbRatings | null };
export type ScoreRequest = { source: string; sourceId: string; imdbId?: string | null; title?: string; year?: number | null; series?: boolean };

// The last settings a title page used, so touching a poster warms the same answer the page will ask for.
let defaults = { tmdb: '', omdb: '', region: '' };
export function setScoreDefaults(tmdb: string, omdb: string, region: string) {
  defaults = { tmdb, omdb, region };
}

export const scoresId = (r: ScoreRequest, region: string, omdbKey: string) => `${r.source}:${r.sourceId}:${region}:${omdbKey ? 'o' : ''}`;

export function loadTitleScores(r: ScoreRequest, key: string, region: string, omdbKey: string): Promise<TitleScores> {
  return cached(`scores:${scoresId(r, region, omdbKey)}`, 60 * MINUTE, async () => {
    const extras = r.source === 'tmdb' && key ? await extrasTmdb(key, r.sourceId, region).catch(() => null) : null;
    let imdb = extras?.imdbId ?? r.imdbId ?? null;
    let omdb = omdbKey && imdb ? await omdbRatings(omdbKey, imdb).catch(() => null) : null;
    // No IMDb id from TMDB: ask OMDb by name and year instead.
    if (omdbKey && !imdb && r.title) {
      const found = await omdbByTitle(omdbKey, r.title, r.year ?? null, !!r.series).catch(() => null);
      if (found) {
        imdb = found.imdbId;
        omdb = found.ratings;
      }
    }
    return { extras: extras ? { ...extras, imdbId: imdb } : imdb ? { score: null, votes: 0, imdbId: imdb, watch: null } : null, omdb };
  });
}

/** Starts loading a title's scores when it's touched, with the settings the title page will use. */
export function warmScores(r: ScoreRequest) {
  const key = defaults.tmdb || tmdbKey('');
  const omdb = defaults.omdb || omdbKeyFor('');
  const region = defaults.region || watchRegion('');
  loadTitleScores(r, key, region, omdb).catch(() => {});
}
