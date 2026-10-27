import type { Entry, MediaKind, WatchItem } from '@/store/types';

import { column, halfStars, hash, importedEntry, importedWatch, kindFrom, ratingScale, records, slashOrder, squash, toDay, yearOf } from './common';
import type { ImportResult, Row } from './common';

// Any other app's export, CSV or JSON: Refract, Serializd, Moviebase, TV Time and the like. Their exact
// formats aren't documented, so columns are recognised by meaning under the names apps commonly use.
// Episodes of a show on the same day become one entry; rows marked "plan to watch" go to the Watchlist.

const NAMES = {
  title: ['title', 'name', 'movietitle', 'moviename', 'filmtitle', 'film', 'movie', 'showtitle', 'showname', 'show', 'seriestitle', 'seriesname', 'series', 'tvshowname', 'tvshow', 'animetitle', 'mediatitle', 'medianame'],
  year: ['year', 'releaseyear', 'yearreleased', 'firstairyear'],
  release: ['releasedate', 'firstairdate', 'released', 'airdate'],
  date: ['watcheddate', 'datewatched', 'watchedat', 'watchedon', 'watched', 'lastwatched', 'lastwatchedat', 'finishedat', 'finisheddate', 'completedat', 'completeddate', 'viewedat', 'seenat', 'datetime', 'date', 'createdat', 'loggedat', 'loggeddate', 'timestamp'],
  rating: ['rating', 'yourrating', 'myrating', 'userrating', 'score', 'myscore', 'stars', 'rate'],
  review: ['review', 'reviewtext', 'comment', 'comments', 'notes', 'note', 'text'],
  type: ['type', 'kind', 'mediatype', 'category', 'contenttype', 'titletype', 'entitytype'],
  season: ['season', 'seasonnumber', 'episodeseasonnumber', 'seasonno'],
  episode: ['episode', 'episodenumber', 'episodeno', 'ep'],
  status: ['status', 'watchstatus', 'state', 'list', 'shelf'],
  imdb: ['imdbid', 'imdb', 'const', 'imdbtt'],
  tmdb: ['tmdbid', 'tmdb'],
  liked: ['liked', 'favorite', 'favourite', 'like', 'loved'],
  rewatch: ['rewatch', 'rewatched', 'isrewatch'],
  tags: ['tags', 'tag', 'labels', 'moods', 'mood'],
} as const;

type Fields = { [K in keyof typeof NAMES]: string | null };

const PLANNED = /plan|want|watchlist|to ?watch|queue|wish/i;
const yes = (v: string | undefined) => /^(1|true|yes|y|♥|❤️?)$/i.test((v ?? '').trim());

/** Recognised columns in a header row; null when there's no title column (so it's not a watch list). */
export function genericFields(headers: string[]): Fields | null {
  const f = Object.fromEntries(Object.entries(NAMES).map(([k, names]) => [k, column(headers, [...names])])) as Fields;
  return f.title ? f : null;
}

function fromRows(rows: Row[], f: Fields, origin: string, kindHint: MediaKind | null): ImportResult {
  const order = slashOrder(f.date ? rows.map((r) => r[f.date!]) : []);
  const scale = f.rating ? ratingScale(rows.map((r) => r[f.rating!])) : 10;
  const entries: Entry[] = [];
  const watchlist: WatchItem[] = [];
  // Episode rows grouped by show and day.
  const groups = new Map<string, { title: string; day: string | null; seasons: Set<string>; count: number; row: Row }>();

  for (const r of rows) {
    const title = r[f.title!]?.trim();
    if (!title) continue;
    const kind = kindFrom(f.type ? r[f.type] : undefined) ?? (f.season || f.episode ? 'tv' : kindHint) ?? 'movie';
    const year = (f.year ? yearOf(r[f.year]) : null) ?? (f.release ? yearOf(r[f.release]) : null);
    const imdbId = f.imdb && /^tt\d+$/.test(r[f.imdb] ?? '') ? r[f.imdb] : null;
    const tmdbId = f.tmdb && /^\d+$/.test(r[f.tmdb] ?? '') ? r[f.tmdb] : null;
    const tmdb = tmdbId ? { source: 'tmdb' as const, sourceId: `${kind === 'movie' ? 'movie' : 'tv'}:${tmdbId}`, fetchedAt: 0 } : {};

    if (f.status && PLANNED.test(r[f.status] ?? '')) {
      watchlist.push(importedWatch(`gw-${origin}-${hash(`${title}|${year}`)}`, { kind, title, year, imdbId, ...tmdb }));
      continue;
    }

    const day = f.date ? toDay(r[f.date], order) : null;
    const season = f.season ? (r[f.season] ?? '').trim() : '';
    const episode = f.episode ? (r[f.episode] ?? '').trim() : '';
    if (kind !== 'movie' && (season || episode)) {
      const k = `${title}|${day}`;
      const g = groups.get(k) ?? { title, day, seasons: new Set<string>(), count: 0, row: r };
      if (season) g.seasons.add(season);
      g.count++;
      groups.set(k, g);
      continue;
    }

    entries.push(
      importedEntry(`g-${origin}-${hash(`${title}|${year}|${day}`)}`, {
        kind,
        title,
        year,
        watchedOn: day,
        rating: f.rating ? halfStars(r[f.rating], scale) : 0,
        review: f.review ? r[f.review] ?? '' : '',
        liked: f.liked ? yes(r[f.liked]) : false,
        rewatch: f.rewatch ? yes(r[f.rewatch]) : false,
        tags: f.tags ? (r[f.tags] ?? '').split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [],
        imdbId,
        ...tmdb,
      }),
    );
  }

  for (const [k, g] of groups) {
    const seasons = [...g.seasons];
    const label = seasons.length === 1 ? `Season ${seasons[0].replace(/^season\s*/i, '')} · ` : '';
    entries.push(
      importedEntry(`g-${origin}-ep-${hash(k)}`, {
        kind: kindFrom(f.type ? g.row[f.type] : undefined) === 'anime' ? 'anime' : 'tv',
        title: g.title,
        watchedOn: g.day,
        progress: `${label}${g.count} ${g.count === 1 ? 'episode' : 'episodes'}`,
      }),
    );
  }
  return { entries, watchlist };
}

/** A CSV from any app; null when it has no recognisable title column. */
export function fromGenericCsv(csv: string, origin: string): ImportResult | null {
  const { headers, rows } = records(csv);
  const f = genericFields(headers);
  if (!f) return null;
  return fromRows(rows, f, origin, kindFrom(origin));
}

/** Flattens a JSON record one level ("movie": { "title": … } → "movie title"), so nested exports read like CSV rows. */
function flatten(o: Record<string, unknown>, prefix = ''): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix} ${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, key));
      // Also offer the inner fields under their own names (a nested "title" still counts as the title).
      for (const [ik, iv] of Object.entries(v as Record<string, unknown>)) if (!(ik in out) && (typeof iv === 'string' || typeof iv === 'number')) out[ik] = String(iv);
    } else if (Array.isArray(v)) out[key] = v.filter((x) => typeof x === 'string').join(', ');
    else if (v !== null && v !== undefined) out[key] = String(v);
  }
  return out;
}

/** The arrays of records in a JSON export: the top level, or lists under keys like "movies", "history", "entries". */
function arraysIn(json: unknown, name = ''): { name: string; items: Record<string, unknown>[] }[] {
  if (Array.isArray(json)) return json.length && typeof json[0] === 'object' ? [{ name, items: json as Record<string, unknown>[] }] : [];
  if (json && typeof json === 'object') return Object.entries(json).flatMap(([k, v]) => arraysIn(v, k));
  return [];
}

/** A JSON export from any app; null when nothing in it looks like a watch list. */
export function fromGenericJson(json: unknown, origin: string): ImportResult | null {
  const result: ImportResult = { entries: [], watchlist: [] };
  let found = false;
  for (const { name, items } of arraysIn(json)) {
    const rows = items.map((i) => flatten(i));
    const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const f = genericFields(headers);
    if (!f) continue;
    found = true;
    const hint = kindFrom(name) ?? kindFrom(origin);
    const part = fromRows(rows, f, `${origin}-${squash(name)}`, hint);
    // A list named like a watchlist goes there whole.
    if (PLANNED.test(name)) result.watchlist.push(...part.entries.map((e) => importedWatch(`gw-${e.id}`, { kind: e.kind, title: e.title, year: e.year, imdbId: e.imdbId })));
    else result.entries.push(...part.entries);
    result.watchlist.push(...part.watchlist);
  }
  return found ? result : null;
}
