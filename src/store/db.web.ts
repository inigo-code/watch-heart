import type { DiaryDb } from './db';
import type { Entry, WatchItem } from './types';

// The web build is only a design preview: it keeps the diary in localStorage instead of SQLite.

export type { DiaryDb };

function store<T extends { id: string }>(key: string) {
  const read = (): Map<string, T> => {
    try {
      return new Map((JSON.parse(globalThis.localStorage?.getItem(key) ?? '[]') as T[]).map((x) => [x.id, x]));
    } catch {
      return new Map();
    }
  };
  const write = (map: Map<string, T>) => globalThis.localStorage?.setItem(key, JSON.stringify([...map.values()]));
  return {
    load: async () => [...read().values()],
    save: async (items: T[]) => {
      const map = read();
      for (const x of items) map.set(x.id, x);
      write(map);
    },
    remove: async (ids: string[]) => {
      const map = read();
      for (const id of ids) map.delete(id);
      write(map);
    },
  };
}

export async function openDiary(): Promise<DiaryDb> {
  const diary = store<Entry>('watchheart/preview-diary');
  const watchlist = store<WatchItem>('watchheart/preview-watchlist');
  return {
    ...diary,
    loadWatchlist: watchlist.load,
    saveWatchlist: watchlist.save,
    removeWatchlist: watchlist.remove,
  };
}
