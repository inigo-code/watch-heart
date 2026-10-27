import type { DiaryDb } from './db';
import type { Entry } from './types';

// The web build is only a design preview: it keeps the diary in localStorage instead of SQLite.

export type { DiaryDb };

const KEY = 'watchheart/preview-diary';

function read(): Map<string, Entry> {
  try {
    return new Map((JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]') as Entry[]).map((e) => [e.id, e]));
  } catch {
    return new Map();
  }
}

const write = (map: Map<string, Entry>) => globalThis.localStorage?.setItem(KEY, JSON.stringify([...map.values()]));

export async function openDiary(): Promise<DiaryDb> {
  return {
    load: async () => [...read().values()],
    save: async (entries) => {
      const map = read();
      for (const e of entries) map.set(e.id, e);
      write(map);
    },
    remove: async (ids) => {
      const map = read();
      for (const id of ids) map.delete(id);
      write(map);
    },
  };
}
