import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { newId } from '@/lib/id';

import { openDiary } from './db';
import type { DiaryDb } from './db';
import type { Entry, EntryDraft } from './types';

/** Deleted entries stay in Trash this long, then they're removed for good. */
export const TRASH_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export type ImportResult = { added: number; updated: number; skipped: number };

type DiaryStore = {
  ready: boolean;
  /** Live entries, newest viewing first. */
  entries: Entry[];
  /** Deleted entries, most recently deleted first. */
  trash: Entry[];
  getEntry: (id: string) => Entry | undefined;
  /** Live entries of the same title (same source and id), newest first. */
  viewingsOf: (source: Entry['source'], sourceId: string) => Entry[];
  addEntry: (draft: EntryDraft) => Entry;
  updateEntry: (id: string, patch: Partial<EntryDraft>) => void;
  deleteEntry: (id: string) => void;
  restoreEntry: (id: string) => void;
  purgeEntry: (id: string) => void;
  emptyTrash: () => void;
  /** Merges entries from a backup: new ids are added, newer edits win, nothing is deleted. */
  importEntries: (list: Entry[]) => ImportResult;
};

const Ctx = createContext<DiaryStore | null>(null);

const byNewest = (a: Entry, b: Entry) => b.watchedOn.localeCompare(a.watchedOn) || b.createdAt - a.createdAt;

export function DiaryStoreProvider({ children }: { children: ReactNode }) {
  const [all, setAll] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  // Opened once; writes wait for it, then go one at a time, in order, so a quick edit-then-delete
  // can't land out of order.
  const db = useRef<Promise<DiaryDb> | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const write = useCallback((fn: (db: DiaryDb) => Promise<unknown>) => {
    db.current ??= openDiary();
    const opened = db.current;
    queue.current = queue.current.then(() => opened.then(fn)).catch((e) => console.warn('Diary write failed', e));
  }, []);

  useEffect(() => {
    db.current ??= openDiary();
    db.current
      .then((d) => d.load())
      .then((list) => {
        // Trash older than TRASH_DAYS is cleared on launch.
        const cutoff = Date.now() - TRASH_DAYS * DAY;
        const expired = list.filter((e) => e.deletedAt !== null && e.deletedAt < cutoff).map((e) => e.id);
        if (expired.length) write((d) => d.remove(expired));
        setAll(list.filter((e) => !expired.includes(e.id)));
      })
      .catch((e) => console.warn('Could not load the diary', e))
      .finally(() => setReady(true));
  }, [write]);

  const mutate = useCallback(
    (id: string, fn: (e: Entry) => Entry) => {
      setAll((list) =>
        list.map((e) => {
          if (e.id !== id) return e;
          const next = fn(e);
          write((d) => d.save([next]));
          return next;
        }),
      );
    },
    [write],
  );

  const addEntry = useCallback(
    (draft: EntryDraft) => {
      const now = Date.now();
      const entry: Entry = { ...draft, id: newId(), createdAt: now, updatedAt: now, deletedAt: null };
      setAll((list) => [...list, entry]);
      write((d) => d.save([entry]));
      return entry;
    },
    [write],
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<EntryDraft>) => mutate(id, (e) => ({ ...e, ...patch, updatedAt: Date.now() })),
    [mutate],
  );
  const deleteEntry = useCallback((id: string) => mutate(id, (e) => ({ ...e, deletedAt: Date.now(), updatedAt: Date.now() })), [mutate]);
  const restoreEntry = useCallback((id: string) => mutate(id, (e) => ({ ...e, deletedAt: null, updatedAt: Date.now() })), [mutate]);

  const purgeEntry = useCallback(
    (id: string) => {
      setAll((list) => list.filter((e) => e.id !== id));
      write((d) => d.remove([id]));
    },
    [write],
  );

  const emptyTrash = useCallback(() => {
    setAll((list) => {
      const ids = list.filter((e) => e.deletedAt !== null).map((e) => e.id);
      write((d) => d.remove(ids));
      return list.filter((e) => e.deletedAt === null);
    });
  }, [write]);

  const importEntries = useCallback(
    (incoming: Entry[]) => {
      const result: ImportResult = { added: 0, updated: 0, skipped: 0 };
      const byId = new Map(all.map((e) => [e.id, e]));
      const changed: Entry[] = [];
      for (const e of incoming) {
        const mine = byId.get(e.id);
        if (!mine) result.added++;
        else if (e.updatedAt > mine.updatedAt) result.updated++;
        else {
          result.skipped++;
          continue;
        }
        byId.set(e.id, e);
        changed.push(e);
      }
      if (changed.length) {
        setAll([...byId.values()]);
        write((d) => d.save(changed));
      }
      return result;
    },
    [all, write],
  );

  const value = useMemo<DiaryStore>(() => {
    const entries = all.filter((e) => e.deletedAt === null).sort(byNewest);
    const trash = all.filter((e) => e.deletedAt !== null).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
    return {
      ready,
      entries,
      trash,
      getEntry: (id) => all.find((e) => e.id === id),
      viewingsOf: (source, sourceId) =>
        source === 'manual' || !sourceId ? [] : entries.filter((e) => e.source === source && e.sourceId === sourceId),
      addEntry,
      updateEntry,
      deleteEntry,
      restoreEntry,
      purgeEntry,
      emptyTrash,
      importEntries,
    };
  }, [all, ready, addEntry, updateEntry, deleteEntry, restoreEntry, purgeEntry, emptyTrash, importEntries]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDiary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDiary must be used inside DiaryStoreProvider');
  return ctx;
}
