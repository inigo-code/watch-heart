import { openDatabaseAsync } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Entry, WatchItem } from './types';

// The diary lives in SQLite on the phone. (db.web.ts stands in for it in the web design preview.)
const DATABASE_NAME = 'watchheart.db';
const DATABASE_VERSION = 3;

/** Creates or upgrades the tables. */
async function migrate(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
PRAGMA journal_mode = 'wal';
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  original_title TEXT,
  year INTEGER,
  poster_url TEXT,
  backdrop_url TEXT,
  genres TEXT NOT NULL DEFAULT '[]',
  runtime INTEGER,
  credit TEXT,
  watched_on TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 0,
  liked INTEGER NOT NULL DEFAULT 0,
  rewatch INTEGER NOT NULL DEFAULT 0,
  progress TEXT NOT NULL DEFAULT '',
  review TEXT NOT NULL DEFAULT '',
  spoilers INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS entries_watched_on ON entries (watched_on);
`);
    version = 1;
  }

  if (version === 1) {
    // The watchlist is small and always loaded whole, so each item is one JSON row.
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS watchlist (
  id TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  added_at INTEGER NOT NULL
);
`);
    version = 2;
  }

  if (version === 2) {
    // Fields added to entries after the table was made (when details were fetched, the IMDb id, an
    // import without a watch date, episodes from the tracker) live in one JSON column, so new ones need
    // no further upgrades. Before this they weren't saved on the phone at all.
    await db.execAsync(`ALTER TABLE entries ADD COLUMN extra TEXT NOT NULL DEFAULT '{}';`);
    version = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

type Row = {
  id: string;
  kind: Entry['kind'];
  source: Entry['source'];
  source_id: string;
  title: string;
  original_title: string | null;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: string;
  runtime: number | null;
  credit: string | null;
  watched_on: string;
  rating: number;
  liked: number;
  rewatch: number;
  progress: string;
  review: string;
  spoilers: number;
  tags: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  extra: string | null;
};

/** The optional fields kept in the extra column. */
const EXTRA_KEYS = ['fetchedAt', 'imdbId', 'matchTriedAt', 'undated', 'episodes'] as const;

function extraOf(e: Entry): string {
  const out: Record<string, unknown> = {};
  for (const k of EXTRA_KEYS) if (e[k] !== undefined && e[k] !== null) out[k] = e[k];
  return JSON.stringify(out);
}

function parseExtra(json: string | null): Partial<Entry> {
  try {
    const v = JSON.parse(json ?? '{}');
    return v && typeof v === 'object' ? (v as Partial<Entry>) : {};
  } catch {
    return {};
  }
}

const list = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};

function fromRow(r: Row): Entry {
  return {
    id: r.id,
    kind: r.kind,
    source: r.source,
    sourceId: r.source_id,
    title: r.title,
    originalTitle: r.original_title,
    year: r.year,
    posterUrl: r.poster_url,
    backdropUrl: r.backdrop_url,
    genres: list(r.genres),
    runtime: r.runtime,
    credit: r.credit,
    watchedOn: r.watched_on,
    rating: r.rating,
    liked: !!r.liked,
    rewatch: !!r.rewatch,
    progress: r.progress,
    review: r.review,
    spoilers: !!r.spoilers,
    tags: list(r.tags),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    ...parseExtra(r.extra),
  };
}

async function saveEntry(db: SQLiteDatabase, e: Entry) {
  await db.runAsync(
    `INSERT OR REPLACE INTO entries (id, kind, source, source_id, title, original_title, year, poster_url, backdrop_url, genres,
      runtime, credit, watched_on, rating, liked, rewatch, progress, review, spoilers, tags, created_at, updated_at, deleted_at, extra)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      e.id,
      e.kind,
      e.source,
      e.sourceId,
      e.title,
      e.originalTitle,
      e.year,
      e.posterUrl,
      e.backdropUrl,
      JSON.stringify(e.genres),
      e.runtime,
      e.credit,
      e.watchedOn,
      e.rating,
      e.liked ? 1 : 0,
      e.rewatch ? 1 : 0,
      e.progress,
      e.review,
      e.spoilers ? 1 : 0,
      JSON.stringify(e.tags),
      e.createdAt,
      e.updatedAt,
      e.deletedAt,
      extraOf(e),
    ],
  );
}

/** Where the diary is kept. The store calls these; it never touches SQL itself. */
export type DiaryDb = {
  load: () => Promise<Entry[]>;
  save: (entries: Entry[]) => Promise<void>;
  remove: (ids: string[]) => Promise<void>;
  loadWatchlist: () => Promise<WatchItem[]>;
  saveWatchlist: (items: WatchItem[]) => Promise<void>;
  removeWatchlist: (ids: string[]) => Promise<void>;
};

export async function openDiary(): Promise<DiaryDb> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  await migrate(db);
  return {
    load: async () => (await db.getAllAsync<Row>('SELECT * FROM entries')).map(fromRow),
    save: async (entries) => {
      if (entries.length === 1) return saveEntry(db, entries[0]);
      await db.withTransactionAsync(async () => {
        for (const e of entries) await saveEntry(db, e);
      });
    },
    remove: async (ids) => {
      if (!ids.length) return;
      await db.runAsync(`DELETE FROM entries WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    },
    loadWatchlist: async () =>
      (await db.getAllAsync<{ data: string }>('SELECT data FROM watchlist ORDER BY added_at DESC')).flatMap((r) => {
        try {
          return [JSON.parse(r.data) as WatchItem];
        } catch {
          return [];
        }
      }),
    saveWatchlist: async (items) => {
      await db.withTransactionAsync(async () => {
        for (const w of items) await db.runAsync('INSERT OR REPLACE INTO watchlist (id, data, added_at) VALUES (?, ?, ?)', [w.id, JSON.stringify(w), w.addedAt]);
      });
    },
    removeWatchlist: async (ids) => {
      if (!ids.length) return;
      await db.runAsync(`DELETE FROM watchlist WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    },
  };
}
