import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { newId } from '@/lib/id';
import { storage } from '@/lib/storage';

import { openDiary } from './db';
import type { DiaryDb } from './db';
import type { Entry, EntryDraft, Title, WatchItem } from './types';

/** Deleted entries stay in Trash this long, then they're removed for good. */
export const TRASH_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;
const SYNC_META_KEY = 'watchheart/sync-meta';

export type ImportResult = { added: number; updated: number; skipped: number };

type TitleRef = Pick<Title, 'source' | 'sourceId' | 'title' | 'year'>;

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** Whether two records are the same title: same id at the same source, else same name and year. */
export function sameTitle(a: TitleRef, b: TitleRef): boolean {
  if (a.source !== 'manual' && a.source === b.source && a.sourceId) return a.sourceId === b.sourceId;
  const name = norm(a.title);
  return name !== '' && name === norm(b.title) && (a.year === b.year || a.year === null || b.year === null);
}

/**
 * What cloud sync needs to know, kept on the phone: which account the data belongs to, how far it
 * has pulled, and which records changed here since they were last sent (id -> when they changed).
 * A pending id that's no longer in the diary or watchlist was deleted, and is sent as a tombstone.
 */
export type SyncMeta = {
  userId: string | null;
  lastPulledAt: string | null;
  entries: Record<string, number>;
  watchlist: Record<string, number>;
};

const emptyMeta = (): SyncMeta => ({ userId: null, lastPulledAt: null, entries: {}, watchlist: {} });

/** A record from the cloud: the app's own JSON, or a tombstone. */
export type RemoteRecord<T> = { id: string; data: T; modifiedAt: number; removed: boolean };

export type SyncStoreApi = {
  meta: SyncMeta;
  /** Bumps on every local change, so sync can follow shortly after. */
  localRevision: number;
  getSnapshot: () => { entries: Entry[]; watchlist: WatchItem[]; meta: SyncMeta };
  /** Applies what was pulled, keeping local changes that are newer and not yet sent. */
  applyRemote: (remote: { entries: RemoteRecord<Entry>[]; watchlist: RemoteRecord<WatchItem>[] }, lastPulledAt: string | null) => void;
  /** Clears records from the pending lists, unless they changed again while sending. */
  markPushed: (sent: { entries: Record<string, number>; watchlist: Record<string, number> }) => void;
  /** Switches sync to this account: everything on the phone is sent to it on the next sync. */
  resetForUser: (userId: string) => void;
  /** Signed out or account deleted: the data stays on the phone, but nothing is tracked for sync. */
  forgetAccount: () => void;
  /** Signing out with "remove from this phone": empties the diary and watchlist here. */
  clearLocal: () => void;
};

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
  /** Titles you want to watch, most recently added first. */
  watchlist: WatchItem[];
  onWatchlist: (t: TitleRef) => WatchItem | undefined;
  addToWatchlist: (t: Title, note?: string) => WatchItem;
  updateWatchItem: (id: string, patch: Partial<WatchItem>) => void;
  removeFromWatchlist: (id: string) => void;
  /** Adds items not already on the list (by id or title); returns how many were added. */
  importWatchlist: (items: WatchItem[]) => number;
  sync: SyncStoreApi;
};

const Ctx = createContext<DiaryStore | null>(null);

const byNewest = (a: Entry, b: Entry) => b.watchedOn.localeCompare(a.watchedOn) || b.createdAt - a.createdAt;
const byAdded = (a: WatchItem, b: WatchItem) => b.addedAt - a.addedAt;

export function DiaryStoreProvider({ children }: { children: ReactNode }) {
  const [all, setAll] = useState<Entry[]>([]);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [meta, setMeta] = useState<SyncMeta>(emptyMeta);
  const [localRevision, setLocalRevision] = useState(0);
  const [ready, setReady] = useState(false);

  // The latest state, for work that runs later (sync, an Undo tapped after the list changed).
  const allRef = useRef(all);
  const watchRef = useRef(watchlist);
  const metaRef = useRef(meta);
  useEffect(() => {
    allRef.current = all;
    watchRef.current = watchlist;
    metaRef.current = meta;
  }, [all, watchlist, meta]);

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
    Promise.all([
      db.current.then((d) => Promise.all([d.load(), d.loadWatchlist()])),
      storage.getItem(SYNC_META_KEY).catch(() => null),
    ])
      .then(([[list, queued], rawMeta]) => {
        // Trash older than TRASH_DAYS is cleared on launch. (Every device does this for itself.)
        const cutoff = Date.now() - TRASH_DAYS * DAY;
        const expired = list.filter((e) => e.deletedAt !== null && e.deletedAt < cutoff).map((e) => e.id);
        if (expired.length) write((d) => d.remove(expired));
        setAll(list.filter((e) => !expired.includes(e.id)));
        setWatchlist(queued.sort(byAdded));
        if (rawMeta) setMeta({ ...emptyMeta(), ...(JSON.parse(rawMeta) as Partial<SyncMeta>) });
      })
      .catch((e) => console.warn('Could not load the diary', e))
      .finally(() => setReady(true));
  }, [write]);

  useEffect(() => {
    if (ready) storage.setItem(SYNC_META_KEY, JSON.stringify(meta)).catch(() => {});
  }, [meta, ready]);

  /** Marks records as changed here, for the next sync (only while signed in). */
  const touch = useCallback((entryIds: string[], watchIds: string[] = []) => {
    if (!entryIds.length && !watchIds.length) return;
    const now = Date.now();
    setMeta((m) => {
      if (!m.userId) return m;
      const entries = { ...m.entries };
      const queued = { ...m.watchlist };
      for (const id of entryIds) entries[id] = now;
      for (const id of watchIds) queued[id] = now;
      return { ...m, entries, watchlist: queued };
    });
    setLocalRevision((r) => r + 1);
  }, []);

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
      touch([id]);
    },
    [write, touch],
  );

  const addEntry = useCallback(
    (draft: EntryDraft) => {
      const now = Date.now();
      const entry: Entry = { ...draft, id: newId(), createdAt: now, updatedAt: now, deletedAt: null };
      setAll((list) => [...list, entry]);
      write((d) => d.save([entry]));
      // Watching something takes it off the watchlist.
      const done = watchRef.current.filter((w) => sameTitle(w, entry)).map((w) => w.id);
      if (done.length) {
        setWatchlist((list) => list.filter((w) => !done.includes(w.id)));
        write((d) => d.removeWatchlist(done));
      }
      touch([entry.id], done);
      return entry;
    },
    [write, touch],
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
      touch([id]);
    },
    [write, touch],
  );

  const emptyTrash = useCallback(() => {
    const ids = allRef.current.filter((e) => e.deletedAt !== null).map((e) => e.id);
    setAll((list) => list.filter((e) => e.deletedAt === null));
    write((d) => d.remove(ids));
    touch(ids);
  }, [write, touch]);

  const importEntries = useCallback(
    (incoming: Entry[]) => {
      const result: ImportResult = { added: 0, updated: 0, skipped: 0 };
      const byId = new Map(allRef.current.map((e) => [e.id, e]));
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
        allRef.current = [...byId.values()];
        setAll(allRef.current);
        write((d) => d.save(changed));
        touch(changed.map((e) => e.id));
      }
      return result;
    },
    [write, touch],
  );

  const addToWatchlist = useCallback(
    (t: Title, note = '') => {
      const item: WatchItem = {
        id: newId(),
        kind: t.kind,
        source: t.source,
        sourceId: t.sourceId,
        title: t.title,
        originalTitle: t.originalTitle ?? null,
        year: t.year,
        posterUrl: t.posterUrl,
        backdropUrl: t.backdropUrl,
        genres: t.genres,
        runtime: t.runtime,
        credit: t.credit ?? null,
        note,
        addedAt: Date.now(),
        fetchedAt: t.source === 'tmdb' ? (t.fetchedAt ?? Date.now()) : null,
      };
      // Saving a title that's already on the list replaces the old item.
      const replaced = watchRef.current.filter((w) => sameTitle(w, item)).map((w) => w.id);
      setWatchlist((list) => [item, ...list.filter((w) => !replaced.includes(w.id))]);
      write((d) => d.saveWatchlist([item]));
      if (replaced.length) write((d) => d.removeWatchlist(replaced));
      touch([], [item.id, ...replaced]);
      return item;
    },
    [write, touch],
  );

  const updateWatchItem = useCallback(
    (id: string, patch: Partial<WatchItem>) => {
      setWatchlist((list) =>
        list.map((w) => {
          if (w.id !== id) return w;
          const next = { ...w, ...patch, id };
          write((d) => d.saveWatchlist([next]));
          return next;
        }),
      );
      touch([], [id]);
    },
    [write, touch],
  );

  const removeFromWatchlist = useCallback(
    (id: string) => {
      setWatchlist((list) => list.filter((w) => w.id !== id));
      write((d) => d.removeWatchlist([id]));
      touch([], [id]);
    },
    [write, touch],
  );

  const importWatchlist = useCallback(
    (items: WatchItem[]) => {
      const fresh = items.filter((i) => !watchRef.current.some((w) => w.id === i.id || sameTitle(w, i)));
      if (fresh.length) {
        watchRef.current = [...watchRef.current, ...fresh].sort(byAdded);
        setWatchlist(watchRef.current);
        write((d) => d.saveWatchlist(fresh));
        touch([], fresh.map((w) => w.id));
      }
      return fresh.length;
    },
    [write, touch],
  );

  // --- Cloud sync -------------------------------------------------------------------------------

  const getSnapshot = useCallback(() => ({ entries: allRef.current, watchlist: watchRef.current, meta: metaRef.current }), []);

  const applyRemote = useCallback<SyncStoreApi['applyRemote']>(
    (remote, lastPulledAt) => {
      const pending = metaRef.current;
      // A local change that's newer than what came down (and not sent yet) wins; sync sends it next.
      const keep = <T,>(r: RemoteRecord<T>, mine: Record<string, number>) => !(mine[r.id] !== undefined && mine[r.id] >= r.modifiedAt);

      const entries = remote.entries.filter((r) => keep(r, pending.entries));
      if (entries.length) {
        const byId = new Map(allRef.current.map((e) => [e.id, e]));
        const saved: Entry[] = [];
        const removed: string[] = [];
        for (const r of entries) {
          if (r.removed) {
            if (byId.delete(r.id)) removed.push(r.id);
          } else {
            byId.set(r.id, r.data);
            saved.push(r.data);
          }
        }
        allRef.current = [...byId.values()];
        setAll(allRef.current);
        if (saved.length) write((d) => d.save(saved));
        if (removed.length) write((d) => d.remove(removed));
      }

      const queued = remote.watchlist.filter((r) => keep(r, pending.watchlist));
      if (queued.length) {
        const byId = new Map(watchRef.current.map((w) => [w.id, w]));
        const saved: WatchItem[] = [];
        const removed: string[] = [];
        for (const r of queued) {
          if (r.removed) {
            if (byId.delete(r.id)) removed.push(r.id);
          } else {
            byId.set(r.id, r.data);
            saved.push(r.data);
          }
        }
        watchRef.current = [...byId.values()].sort(byAdded);
        setWatchlist(watchRef.current);
        if (saved.length) write((d) => d.saveWatchlist(saved));
        if (removed.length) write((d) => d.removeWatchlist(removed));
      }

      setMeta((m) => ({ ...m, lastPulledAt }));
    },
    [write],
  );

  const markPushed = useCallback<SyncStoreApi['markPushed']>((sent) => {
    setMeta((m) => {
      const entries = { ...m.entries };
      const queued = { ...m.watchlist };
      for (const [id, at] of Object.entries(sent.entries)) if (entries[id] === at) delete entries[id];
      for (const [id, at] of Object.entries(sent.watchlist)) if (queued[id] === at) delete queued[id];
      metaRef.current = { ...m, entries, watchlist: queued };
      return metaRef.current;
    });
  }, []);

  const resetForUser = useCallback((userId: string) => {
    const now = Date.now();
    const next: SyncMeta = {
      userId,
      lastPulledAt: null,
      entries: Object.fromEntries(allRef.current.map((e) => [e.id, now])),
      watchlist: Object.fromEntries(watchRef.current.map((w) => [w.id, now])),
    };
    metaRef.current = next;
    setMeta(next);
    setLocalRevision((r) => r + 1);
  }, []);

  const forgetAccount = useCallback(() => {
    metaRef.current = emptyMeta();
    setMeta(metaRef.current);
  }, []);

  const clearLocal = useCallback(() => {
    const entryIds = allRef.current.map((e) => e.id);
    const watchIds = watchRef.current.map((w) => w.id);
    allRef.current = [];
    watchRef.current = [];
    setAll([]);
    setWatchlist([]);
    write((d) => d.remove(entryIds));
    write((d) => d.removeWatchlist(watchIds));
  }, [write]);

  const sync = useMemo<SyncStoreApi>(
    () => ({ meta, localRevision, getSnapshot, applyRemote, markPushed, resetForUser, forgetAccount, clearLocal }),
    [meta, localRevision, getSnapshot, applyRemote, markPushed, resetForUser, forgetAccount, clearLocal],
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
      watchlist,
      onWatchlist: (t) => watchlist.find((w) => sameTitle(w, t)),
      addToWatchlist,
      updateWatchItem,
      removeFromWatchlist,
      importWatchlist,
      sync,
    };
  }, [all, ready, addEntry, updateEntry, deleteEntry, restoreEntry, purgeEntry, emptyTrash, importEntries, watchlist, addToWatchlist, updateWatchItem, removeFromWatchlist, importWatchlist, sync]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDiary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDiary must be used inside DiaryStoreProvider');
  return ctx;
}

/** A watchlist item as a title, e.g. to open the log screen for it. */
export function titleOf(w: WatchItem): Title {
  return {
    kind: w.kind,
    source: w.source,
    sourceId: w.sourceId,
    title: w.title,
    originalTitle: w.originalTitle ?? undefined,
    year: w.year,
    posterUrl: w.posterUrl,
    backdropUrl: w.backdropUrl,
    genres: w.genres,
    runtime: w.runtime,
    credit: w.credit,
    fetchedAt: w.fetchedAt ?? w.addedAt,
  };
}
