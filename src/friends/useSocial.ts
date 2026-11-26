import { useCallback, useEffect, useMemo, useState } from 'react';

import { entrySocial, likeEntry, myId, socialKey } from '@/friends/socialApi';
import type { Social } from '@/friends/socialApi';
import type { Entry } from '@/store/types';

// Like and comment counts, shared by every screen that shows an entry, so a like on the entry page shows on
// the feed when you go back. Fetched in batches; a like changes at once and is put back if it fails.

const counts = new Map<string, Social>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** Friends' entries, last opened, so an entry page can show at once without asking the server. */
export const friendEntryCache = new Map<string, Entry>();

export function setSocial(key: string, next: Social) {
  counts.set(key, next);
  changed();
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
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const keys = useMemo(() => items.map((i) => socialKey(i.ownerId, i.entryId)), [items]);
  const wanted = keys.join('|');

  useEffect(() => {
    const listen = () => setTick((t) => t + 1);
    listeners.add(listen);
    return () => {
      listeners.delete(listen);
    };
  }, []);

  useEffect(() => {
    if (!wanted) return;
    let live = true;
    entrySocial(items)
      .then((got) => {
        if (!live) return;
        for (const [k, v] of Object.entries(got)) counts.set(k, v);
        setReady(Object.keys(got).length > 0 || items.length === 0);
        changed();
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // `wanted` stands for `items`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  const get = useCallback((ownerId: string, entryId: string) => counts.get(socialKey(ownerId, entryId)), []);

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
