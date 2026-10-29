import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { newId } from '@/lib/id';
import { storage } from '@/lib/storage';
import { sameTitle } from '@/store/DiaryStore';
import type { MediaKind, Source, Title } from '@/store/types';

// Your own lists ("Best of 2026", "Ghibli ranked", "Comfort rewatches"): a name, a line about it, and
// titles in your order, optionally ranked. Kept on the phone as JSON and synced like the profile: one
// record per list, the newest edit wins, and a deleted list leaves a marker until the cloud has it.

export type ListItem = { kind: MediaKind; source: Source; sourceId: string; title: string; year: number | null; posterUrl: string | null };

export type UserList = {
  id: string;
  name: string;
  description: string;
  /** Show the order as 1, 2, 3… */
  ranked: boolean;
  items: ListItem[];
  createdAt: number;
  updatedAt: number;
  /** Deleted here; kept as a marker until sync has sent it. */
  deletedAt: number | null;
  /** The updatedAt the cloud last had (0: never sent). */
  syncedAt: number;
};

const KEY = 'watchheart/lists';
const META_KEY = 'watchheart/lists-sync';

/** Which account the lists were last synced with. */
export type ListsMeta = { userId: string | null };

type ListsContext = {
  ready: boolean;
  /** Your lists, most recently changed first (deleted ones left out). */
  lists: UserList[];
  getList: (id: string) => UserList | undefined;
  createList: (name: string, description?: string) => UserList;
  updateList: (id: string, patch: Partial<Pick<UserList, 'name' | 'description' | 'ranked'>>) => void;
  deleteList: (id: string) => void;
  /** Adds a title to the end of a list (once). */
  addItem: (id: string, t: ListItem | Title) => void;
  removeItem: (id: string, index: number) => void;
  moveItem: (id: string, from: number, to: number) => void;
  /** The lists a title is on. */
  listsWith: (t: Pick<ListItem, 'source' | 'sourceId' | 'title' | 'year'>) => UserList[];
  // For sync: every record including deleted ones, and how to apply what came back.
  all: () => UserList[];
  meta: ListsMeta;
  setMeta: (m: ListsMeta) => void;
  /** Merges lists from the cloud (newer wins) and marks sent ones as synced. */
  applySync: (incoming: UserList[], sent: { id: string; updatedAt: number }[]) => void;
  /** A change here, for sync to follow. */
  revision: number;
  /** Signing out with "remove from this phone": the lists go too (the account keeps them). */
  clear: () => void;
};

const Ctx = createContext<ListsContext | null>(null);

const toItem = (t: ListItem | Title): ListItem => ({ kind: t.kind, source: t.source, sourceId: t.sourceId, title: t.title, year: t.year, posterUrl: t.posterUrl });

export function ListsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<UserList[]>([]);
  const [meta, setMetaState] = useState<ListsMeta>({ userId: null });
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const ref = useRef(records);
  useEffect(() => {
    ref.current = records;
  }, [records]);

  useEffect(() => {
    Promise.all([storage.getItem(KEY), storage.getItem(META_KEY)])
      .then(([raw, rawMeta]) => {
        if (raw) setRecords(JSON.parse(raw) as UserList[]);
        if (rawMeta) setMetaState(JSON.parse(rawMeta) as ListsMeta);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) storage.setItem(KEY, JSON.stringify(records)).catch(() => {});
  }, [records, ready]);

  const setMeta = useCallback((m: ListsMeta) => {
    setMetaState(m);
    storage.setItem(META_KEY, JSON.stringify(m)).catch(() => {});
  }, []);

  /** Changes one list (stamped now) and tells sync. */
  const change = useCallback((id: string, fn: (l: UserList) => UserList) => {
    setRecords((list) => list.map((l) => (l.id === id ? { ...fn(l), updatedAt: Math.max(Date.now(), l.updatedAt + 1) } : l)));
    setRevision((r) => r + 1);
  }, []);

  const createList = useCallback((name: string, description = '') => {
    const now = Date.now();
    const l: UserList = { id: newId(), name: name.trim() || 'Untitled list', description: description.trim(), ranked: false, items: [], createdAt: now, updatedAt: now, deletedAt: null, syncedAt: 0 };
    setRecords((list) => [l, ...list]);
    setRevision((r) => r + 1);
    return l;
  }, []);

  const updateList = useCallback<ListsContext['updateList']>((id, patch) => change(id, (l) => ({ ...l, ...patch })), [change]);
  const deleteList = useCallback((id: string) => change(id, (l) => ({ ...l, deletedAt: Date.now() })), [change]);
  const addItem = useCallback<ListsContext['addItem']>(
    (id, t) => change(id, (l) => (l.items.some((x) => sameTitle(x, t)) ? l : { ...l, items: [...l.items, toItem(t)] })),
    [change],
  );
  const removeItem = useCallback((id: string, index: number) => change(id, (l) => ({ ...l, items: l.items.filter((_, i) => i !== index) })), [change]);
  const moveItem = useCallback(
    (id: string, from: number, to: number) =>
      change(id, (l) => {
        if (to < 0 || to >= l.items.length || from === to) return l;
        const items = [...l.items];
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
        return { ...l, items };
      }),
    [change],
  );

  const applySync = useCallback<ListsContext['applySync']>((incoming, sent) => {
    setRecords((list) => {
      const byId = new Map(list.map((l) => [l.id, l]));
      for (const s of sent) {
        const l = byId.get(s.id);
        if (!l) continue;
        // A deleted list the cloud now knows about can go; otherwise remember what was sent.
        if (l.deletedAt && l.updatedAt === s.updatedAt) byId.delete(s.id);
        else byId.set(s.id, { ...l, syncedAt: Math.max(l.syncedAt, s.updatedAt) });
      }
      for (const r of incoming) {
        const mine = byId.get(r.id);
        if (mine && mine.updatedAt >= r.updatedAt) continue;
        if (r.deletedAt) byId.delete(r.id);
        else byId.set(r.id, { ...r, syncedAt: r.updatedAt });
      }
      return [...byId.values()];
    });
  }, []);

  const lists = useMemo(() => records.filter((l) => !l.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt), [records]);
  const value = useMemo<ListsContext>(
    () => ({
      ready,
      lists,
      getList: (id) => lists.find((l) => l.id === id),
      createList,
      updateList,
      deleteList,
      addItem,
      removeItem,
      moveItem,
      listsWith: (t) => lists.filter((l) => l.items.some((x) => sameTitle(x, t))),
      all: () => ref.current,
      meta,
      setMeta,
      applySync,
      revision,
      clear: () => {
        setRecords([]);
        setMeta({ userId: null });
      },
    }),
    [ready, lists, createList, updateList, deleteList, addItem, removeItem, moveItem, meta, setMeta, applySync, revision],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLists() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLists must be used inside ListsProvider');
  return ctx;
}
