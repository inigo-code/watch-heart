import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { entrySocial, likeEntry, myId, socialKey } from '@/friends/socialApi';
import type { Social } from '@/friends/socialApi';
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
  const now = counts.get(key);
  if (now) setSocial(key, { ...now, comments: Math.max(0, now.comments + by) });
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
