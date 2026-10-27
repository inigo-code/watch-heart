import { isoDate } from '@/lib/dates';
import type { Entry, MediaKind, WatchItem } from '@/store/types';

// Shared helpers for the importers: CSV parsing, flexible column lookup, dates, ratings and records.

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

export type Row = Record<string, string>;

/** CSV rows as objects keyed by the header row. */
export function records(text: string): { headers: string[]; rows: Row[] } {
  const [head, ...rows] = parseCsv(text.replace(/^﻿/, ''));
  if (!head) return { headers: [], rows: [] };
  const headers = head.map((h) => h.trim());
  return { headers, rows: rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}

/** A column name reduced to letters and digits, for matching "Watched Date", "watched_date", "watchedDate". */
export const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The first column whose squashed name is one of `names`, or null. */
export function column(headers: string[], names: string[]): string | null {
  const wanted = new Set(names);
  return headers.find((h) => wanted.has(squash(h))) ?? null;
}

/** A short stable id from text (FNV-1a), so importing the same export twice adds nothing new. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Order of the day and month in slash dates (10/24/26 or 24/10/2026), guessed from a whole file's values. */
export function slashOrder(values: string[]): 'dmy' | 'mdy' {
  for (const v of values) {
    const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/);
    if (!m) continue;
    if (Number(m[1]) > 12) return 'dmy';
    if (Number(m[2]) > 12) return 'mdy';
  }
  // Undecided: follow the phone's region (month first only in the US and a few others).
  const region = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[1] ?? '';
  return ['US', 'PH', 'CA', 'FM'].includes(region.toUpperCase()) ? 'mdy' : 'dmy';
}

/**
 * Any common date format as a local YYYY-MM-DD: 2026-10-24, 2026-10-24T20:15:00Z (in local time),
 * 10/24/26, 24.10.2026. Null when there's no usable date (empty, 0000-00-00).
 */
export function toDay(value: string | undefined | null, order: 'dmy' | 'mdy' = 'dmy'): string | null {
  const v = (value ?? '').trim();
  if (!v || /^0000/.test(v)) return null;
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d/.test(v)) {
    // A timestamp: UTC unless it says otherwise; shown on the day it was where you are.
    const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? v.replace(' ', 'T') : `${v.replace(' ', 'T')}Z`);
    return Number.isNaN(d.getTime()) ? null : isoDate(d);
  }
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const [a, b] = order === 'mdy' ? [m[2], m[1]] : [m[1], m[2]];
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const day = Number(a);
    const month = Number(b);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : isoDate(d);
}

/** A rating on any scale (5 stars, 10 points, 100 points) as Watch Heart's half stars, 0–10. */
export function halfStars(value: string | number | undefined | null, scale: 5 | 10 | 100): number {
  const n = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return 0;
  const r = Math.round(scale === 5 ? n * 2 : scale === 10 ? n : n / 10);
  return Math.max(0, Math.min(10, r));
}

/** Guesses a rating column's scale from its values. */
export function ratingScale(values: (string | number)[]): 5 | 10 | 100 {
  const nums = values.map((v) => Number(String(v).replace(',', '.'))).filter((n) => Number.isFinite(n) && n > 0);
  const max = Math.max(0, ...nums);
  return max > 10 ? 100 : max > 5 ? 10 : 5;
}

export function kindFrom(value: string | undefined): MediaKind | null {
  const v = (value ?? '').toLowerCase();
  if (/anime/.test(v)) return 'anime';
  if (/movie|film|feature/.test(v)) return 'movie';
  if (/tv|show|series|episode|season|mini/.test(v)) return 'tv';
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A diary entry from an import, with everything optional filled in. */
export function importedEntry(id: string, p: Omit<Partial<Entry>, 'watchedOn'> & { title: string; kind: MediaKind; watchedOn: string | null }): Entry {
  const now = Date.now();
  const watchedOn = p.watchedOn ?? isoDate(new Date());
  const created = p.createdAt ?? (p.watchedOn ? new Date(`${p.watchedOn}T12:00:00`).getTime() : now);
  return {
    id,
    source: 'manual',
    sourceId: '',
    originalTitle: null,
    year: null,
    posterUrl: null,
    backdropUrl: null,
    genres: [],
    runtime: null,
    credit: null,
    rating: 0,
    liked: false,
    rewatch: false,
    progress: '',
    review: '',
    spoilers: false,
    tags: [],
    updatedAt: Math.min(created, now),
    deletedAt: null,
    ...p,
    watchedOn,
    undated: p.watchedOn ? undefined : true,
    createdAt: Number.isFinite(created) ? Math.min(created, now) : now - DAY_MS,
  };
}

/** A watchlist item from an import. */
export function importedWatch(id: string, p: Partial<WatchItem> & { title: string; kind: MediaKind }): WatchItem {
  return {
    id,
    source: 'manual',
    sourceId: '',
    originalTitle: null,
    year: null,
    posterUrl: null,
    backdropUrl: null,
    genres: [],
    runtime: null,
    credit: null,
    note: '',
    addedAt: Date.now(),
    ...p,
  };
}

/** Years like "2023", or the year in a date; null otherwise. */
export function yearOf(value: string | number | undefined | null): number | null {
  const m = String(value ?? '').match(/\b(18|19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

export type ImportResult = { entries: Entry[]; watchlist: WatchItem[] };
