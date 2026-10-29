import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { myFriends, photoUrl } from '@/friends/friendsApi';
import type { Friend } from '@/friends/friendsApi';
import { useSync } from '@/sync/SyncProvider';

type FriendsContext = {
  /** Signed in, so friends are possible. */
  available: boolean;
  friends: Friend[];
  /** Friend id → a link to their photo, for this session. */
  photos: Record<string, string>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  byId: (id: string) => Friend | undefined;
};

const Ctx = createContext<FriendsContext | null>(null);

type Loaded = { owner: string; friends: Friend[]; photos: Record<string, string> };

async function load(owner: string): Promise<Loaded> {
  const friends = await myFriends();
  const links = await Promise.all(friends.map(async (f) => [f.id, f.photoPath ? await photoUrl(f.photoPath) : null] as const));
  const photos: Record<string, string> = {};
  for (const [id, url] of links) if (url) photos[id] = url;
  return { owner, friends, photos };
}

const message = (e: unknown) => (e instanceof Error ? e.message : 'Couldn’t load your friends.');

/** Your friends, fetched when you sign in and whenever a screen asks for a refresh. */
export function FriendsProvider({ children }: { children: ReactNode }) {
  const { email } = useSync();
  const available = !!email;
  const [state, setState] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failure, setFailure] = useState<{ owner: string; error: string } | null>(null);
  const current = state && state.owner === email ? state : null;
  const error = failure && failure.owner === email ? failure.error : null;
  // Loading: refreshing, or signed in and the first load hasn't come back yet.
  const loading = refreshing || (!!email && !current && !error);

  // Signing in (or into another account) loads that account's friends.
  useEffect(() => {
    if (!email) return;
    let live = true;
    load(email)
      .then((r) => live && setState(r))
      .catch((e) => live && setFailure({ owner: email, error: message(e) }));
    return () => {
      live = false;
    };
  }, [email]);

  const refresh = useCallback(async () => {
    if (!email) return;
    setRefreshing(true);
    try {
      setState(await load(email));
      setFailure(null);
    } catch (e) {
      setFailure({ owner: email, error: message(e) });
    } finally {
      setRefreshing(false);
    }
  }, [email]);

  const value = useMemo<FriendsContext>(() => {
    const friends = current?.friends ?? [];
    return {
      available,
      friends,
      photos: current?.photos ?? {},
      loading,
      error,
      refresh,
      byId: (id) => friends.find((f) => f.id === id),
    };
  }, [available, current, loading, error, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFriends() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFriends must be used inside FriendsProvider');
  return ctx;
}
