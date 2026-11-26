import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { addComment, deleteComment, entrySocial, entryThread, likeEntry, myId, socialKey } from '@/friends/socialApi';
import type { Comment, Social } from '@/friends/socialApi';
import type { Entry } from '@/store/types';

// Like and comment counts, shared by every screen that shows an entry, so a like on the entry page shows on
// the feed when you go back. Fetched in batches; a like changes at once and is put back if it fails.
// Every change makes a new map, which screens read through useSyncExternalStore: the React Compiler keeps
// what a render read from a map that changed in place, and the button then showed the like before last.

let counts: ReadonlyMap<string, Social> = new Map();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const current = () => counts;

function put(entries: [string, Social][]) {
  const next = new Map(counts);
  for (const [k, v] of entries) next.set(k, v);
  counts = next;
  listeners.forEach((l) => l());
}

/** Friends' entries, last opened, so an entry page can show at once without asking the server. */
export const friendEntryCache = new Map<string, Entry>();

export function setSocial(key: string, next: Social) {
  put([[key, next]]);
}

/** One more (or one fewer) comment on an entry, after you post or delete one. */
export function bumpComments(key: string, by: number) {
  const now = counts.get(key) ?? { likes: 0, liked: false, comments: 0 };
  setSocial(key, { ...now, comments: Math.max(0, now.comments + by) });
}

// --- Conversations ------------------------------------------------------------------------------------------
// Each entry's comments, kept for the session like the counts, so a comment shows at once wherever the entry
// does. Yours appear the moment you send them (marked pending until the server has them), and are taken back
// if it says no.

export type ShownComment = Comment & { pending?: boolean };
let threads: ReadonlyMap<string, ShownComment[]> = new Map();
const threadListeners = new Set<() => void>();
const subscribeThreads = (l: () => void) => {
  threadListeners.add(l);
  return () => {
    threadListeners.delete(l);
  };
};
const currentThreads = () => threads;
function putThread(key: string, list: ShownComment[]) {
  const next = new Map(threads);
  next.set(key, list);
  threads = next;
  threadListeners.forEach((l) => l());
}

/** The conversation on an entry: loaded when `load` is true, then kept. `null` until it's there. */
export function useThread(ownerId: string, entryId: string, load = true) {
  const all = useSyncExternalStore(subscribeThreads, currentThreads);
  const key = socialKey(ownerId, entryId);
  const [failed, setFailed] = useState<unknown>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!load || !ownerId || !entryId) return;
    let live = true;
    entryThread(ownerId, entryId)
      .then((t) => {
        if (!live) return;
        setFailed(null);
        // Keep anything of yours still on its way.
        const sending = (threads.get(key) ?? []).filter((c) => c.pending);
        putThread(key, [...t, ...sending]);
        const now = counts.get(key);
        if (now && now.comments !== t.length + sending.length) setSocial(key, { ...now, comments: t.length + sending.length });
      })
      .catch((e: unknown) => live && setFailed(e));
    return () => {
      live = false;
    };
  }, [key, ownerId, entryId, load, round]);
  return { thread: all.get(key) ?? null, failed, retry: () => setRound((r) => r + 1) };
}

/** Posts a comment: it shows at once, then gets its real id; if the server refuses, it's taken back and this throws. */
export async function postComment(ownerId: string, entryId: string, words: string, me: { id: string; name: string; photoPath: string | null }) {
  const key = socialKey(ownerId, entryId);
  const temp: ShownComment = { id: `sending-${Date.now()}`, authorId: me.id, name: me.name || 'You', photoPath: me.photoPath, body: words.trim(), at: new Date().toISOString(), pending: true };
  putThread(key, [...(threads.get(key) ?? []), temp]);
  bumpComments(key, 1);
  try {
    const id = await addComment(ownerId, entryId, words);
    const list = threads.get(key) ?? [];
    if (id && list.some((c) => c.id === id)) {
      // A reload meanwhile already brought the real one.
      putThread(key, list.filter((c) => c.id !== temp.id));
      bumpComments(key, -1);
    } else putThread(key, list.map((c) => (c.id === temp.id ? { ...c, id: id || c.id, pending: false } : c)));
  } catch (e) {
    putThread(key, (threads.get(key) ?? []).filter((c) => c.id !== temp.id));
    bumpComments(key, -1);
    throw e;
  }
}

/** Deletes a comment at once; puts it back if the server refuses, and throws. */
export async function removeComment(ownerId: string, entryId: string, c: ShownComment) {
  const key = socialKey(ownerId, entryId);
  const before = threads.get(key) ?? [];
  putThread(key, before.filter((x) => x.id !== c.id));
  bumpComments(key, -1);
  try {
    await deleteComment(c.id);
  } catch (e) {
    putThread(key, before);
    bumpComments(key, 1);
    throw e;
  }
}

/**
 * Counts for these entries: fetched when the list changes, read from what's known meanwhile. `ready` is
 * false until the server answers, and stays false when it doesn't have likes yet.
 */
export function useSocial(items: { ownerId: string; entryId: string }[]) {
  const known = useSyncExternalStore(subscribe, current);
  const [ready, setReady] = useState(false);
  const keys = useMemo(() => items.map((i) => socialKey(i.ownerId, i.entryId)), [items]);
  const wanted = keys.join('|');

  useEffect(() => {
    if (!wanted) return;
    let live = true;
    entrySocial(items)
      .then((got) => {
        if (!live) return;
        setReady(Object.keys(got).length > 0 || items.length === 0);
        put(Object.entries(got));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // `wanted` stands for `items`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  const get = useCallback((ownerId: string, entryId: string) => known.get(socialKey(ownerId, entryId)), [known]);

  const toggleLike = useCallback(async (ownerId: string, entryId: string) => {
    const key = socialKey(ownerId, entryId);
    const was = counts.get(key) ?? { likes: 0, liked: false, comments: 0 };
    setSocial(key, { ...was, liked: !was.liked, likes: Math.max(0, was.likes + (was.liked ? -1 : 1)) });
    try {
      await likeEntry(ownerId, entryId, !was.liked);
    } catch (e) {
      setSocial(key, was);
      throw e;
    }
  }, []);

  return { get, toggleLike, ready };
}

/** Your account id while signed in (read from the saved sign-in), else null. */
export function useMyId(signedIn: boolean) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    myId().then((v) => live && setId(v));
    return () => {
      live = false;
    };
  }, [signedIn]);
  return signedIn ? id : null;
}
