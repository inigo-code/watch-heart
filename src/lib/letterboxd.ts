import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { strFromU8, unzipSync } from 'fflate';
import { Platform } from 'react-native';

import { searchTmdb, tmdbById } from '@/api/tmdb';
import type { Entry, Title, WatchItem } from '@/store/types';

// Imports a Letterboxd export (letterboxd.com/settings/data → Export your data). Pick the .zip as it
// comes, or any of its CSVs:
// - diary.csv: each logged viewing (date, rating, rewatch, tags)
// - reviews.csv: the same viewings with review text; reviews never logged in the diary become entries too
// - likes/films.csv: films you hearted, marked as liked
// - watchlist.csv: goes to the Watchlist
// watched.csv and ratings.csv have no watch dates, so they aren't diary entries and are skipped.

/** Parses CSV (RFC 4180: quoted fields, doubled quotes, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

/** CSV rows as objects keyed by the header row. */
function records(text: string): Record<string, string>[] {
  const [head, ...rows] = parseCsv(text.replace(/^﻿/, ''));
  if (!head) return [];
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/** A short stable id from text (FNV-1a), so importing the same export twice adds nothing new. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const filmKey = (name: string, year: string) => `${name.toLowerCase()}|${year}`;
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const time = (s: string) => (isDate(s) ? new Date(`${s}T12:00:00`).getTime() : Date.now());
/** Letterboxd reviews can carry a little HTML (<i>, <b>, <br>). */
const plain = (s: string) => s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();

export type LetterboxdFiles = Partial<Record<'diary' | 'reviews' | 'likes' | 'watchlist', string>>;

/** Turns the export's CSVs into diary entries and watchlist items. Pure, so it's easy to check. */
export function fromLetterboxd(files: LetterboxdFiles): { entries: Entry[]; watchlist: WatchItem[] } {
  const liked = new Set(records(files.likes ?? '').map((r) => filmKey(r.Name, r.Year)));
  const reviews = records(files.reviews ?? '');
  const reviewByUri = new Map(reviews.map((r) => [r['Letterboxd URI'], r]));
  const used = new Set<string>();

  const entry = (r: Record<string, string>, review: string): Entry | null => {
    const watchedOn = isDate(r['Watched Date']) ? r['Watched Date'] : isDate(r.Date) ? r.Date : '';
    if (!r.Name || !watchedOn) return null;
    const year = Number(r.Year) || null;
    const created = time(r.Date);
    return {
      id: `lb-${hash(r['Letterboxd URI'] || `${r.Name}|${r.Year}|${watchedOn}`)}`,
      kind: 'movie',
      source: 'manual',
      sourceId: '',
      title: r.Name,
      originalTitle: null,
      year,
      posterUrl: null,
      backdropUrl: null,
      genres: [],
      runtime: null,
      credit: null,
      watchedOn,
      rating: Math.round(Number(r.Rating || 0) * 2),
      liked: liked.has(filmKey(r.Name, r.Year)),
      rewatch: /^yes$/i.test(r.Rewatch ?? ''),
      progress: '',
      review: plain(review),
      spoilers: false,
      tags: (r.Tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: created,
      updatedAt: created,
      deletedAt: null,
    };
  };

  const entries: Entry[] = [];
  for (const r of records(files.diary ?? '')) {
    const review = reviewByUri.get(r['Letterboxd URI']);
    if (review) used.add(r['Letterboxd URI']);
    const e = entry(r, review?.Review ?? '');
    if (e) entries.push(e);
  }
  // Reviews of viewings that aren't in diary.csv (or when only reviews.csv was picked).
  for (const r of reviews) {
    if (used.has(r['Letterboxd URI'])) continue;
    const e = entry(r, r.Review ?? '');
    if (e && !entries.some((x) => x.id === e.id)) entries.push(e);
  }

  const watchlist: WatchItem[] = records(files.watchlist ?? '')
    .filter((r) => r.Name)
    .map((r) => ({
      id: `lbw-${hash(r['Letterboxd URI'] || `${r.Name}|${r.Year}`)}`,
      kind: 'movie',
      source: 'manual',
      sourceId: '',
      title: r.Name,
      originalTitle: null,
      year: Number(r.Year) || null,
      posterUrl: null,
      backdropUrl: null,
      genres: [],
      runtime: null,
      credit: null,
      note: '',
      addedAt: time(r.Date),
    }));

  return { entries, watchlist };
}

/** Which part of the export a file is, from its name (the CSVs alone can't tell watched from watchlist). */
function partOf(name: string): keyof LetterboxdFiles | null {
  const n = name.toLowerCase().replace(/\\/g, '/');
  if (n.endsWith('diary.csv')) return 'diary';
  if (n.endsWith('reviews.csv') && !n.includes('deleted')) return 'reviews';
  if (n.endsWith('likes/films.csv')) return 'likes';
  if (n.endsWith('watchlist.csv')) return 'watchlist';
  return null;
}

async function bytesOf(uri: string): Promise<Uint8Array> {
  if (Platform.OS === 'web') return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  return new File(uri).bytes();
}

/** Lets you pick the export .zip (or its CSVs). Null if cancelled; throws if nothing usable was picked. */
export async function pickLetterboxd(): Promise<LetterboxdFiles | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/zip', 'application/x-zip-compressed', 'text/csv', 'text/comma-separated-values', '*/*'],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const files: LetterboxdFiles = {};
  for (const asset of res.assets) {
    const bytes = await bytesOf(asset.uri);
    // A zip starts with "PK".
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      const unzipped = unzipSync(bytes, { filter: (f) => partOf(f.name) !== null && !f.name.toLowerCase().includes('deleted') });
      for (const [name, data] of Object.entries(unzipped)) {
        const part = partOf(name);
        if (part) files[part] = strFromU8(data);
      }
    } else {
      const part = partOf(asset.name ?? '');
      if (part) files[part] = strFromU8(bytes);
    }
  }
  if (!Object.keys(files).length) {
    throw new Error('That isn’t a Letterboxd export. Pick the .zip from letterboxd.com → Settings → Data, or diary.csv.');
  }
  return files;
}

/**
 * Finds a film on TMDB by name and year, with its poster, genres, running time and director.
 * Null when nothing matches.
 */
async function matchFilm(key: string, title: string, year: number | null, signal?: AbortSignal): Promise<Title | null> {
  const hits = await searchTmdb(key, 'movie', title, signal, year ?? undefined);
  const hit = hits.find((h) => h.year === year) ?? hits[0] ?? (year ? (await searchTmdb(key, 'movie', title, signal))[0] : undefined);
  if (!hit) return null;
  return tmdbById(key, 'movie', hit.sourceId.split(':')[1], signal);
}

/**
 * Fills in posters for imported films (or anything typed in by hand) from TMDB, a few at a time.
 * `apply` gets each match as it's found; returns how many were matched.
 */
export async function fetchPosters<T extends { id: string; title: string; year: number | null }>(
  key: string,
  items: T[],
  apply: (item: T, match: Title) => void,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<number> {
  let next = 0;
  let done = 0;
  let matched = 0;
  const worker = async () => {
    while (next < items.length && !signal?.aborted) {
      const item = items[next++];
      try {
        const match = await matchFilm(key, item.title, item.year, signal);
        if (match) {
          apply(item, match);
          matched++;
        }
      } catch {
        // One film failing to match shouldn't stop the rest.
      }
      onProgress(++done, items.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return matched;
}
