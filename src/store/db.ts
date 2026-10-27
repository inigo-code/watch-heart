import { openDatabaseAsync } from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Entry } from './types';

// The diary lives in SQLite on the phone. (db.web.ts stands in for it in the web design preview.)
const DATABASE_NAME = 'watchheart.db';
const DATABASE_VERSION = 1;

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
};

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
  };
}

async function saveEntry(db: SQLiteDatabase, e: Entry) {
  await db.runAsync(
    `INSERT OR REPLACE INTO entries (id, kind, source, source_id, title, original_title, year, poster_url, backdrop_url, genres,
      runtime, credit, watched_on, rating, liked, rewatch, progress, review, spoilers, tags, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ],
  );
}

/** Where the diary is kept. The store calls these; it never touches SQL itself. */
export type DiaryDb = {
  load: () => Promise<Entry[]>;
  save: (entries: Entry[]) => Promise<void>;
  remove: (ids: string[]) => Promise<void>;
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
  };
}
