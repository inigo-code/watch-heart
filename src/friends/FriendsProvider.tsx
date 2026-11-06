import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { rememberFriends } from '@/friends/friendAlerts';
import { friendRequests, myFriends, notSetUp, photoUrl } from '@/friends/friendsApi';
import type { Friend, FriendRequest } from '@/friends/friendsApi';
import { useSync } from '@/sync/SyncProvider';

type FriendsContext = {
  /** Signed in, so friends are possible. */
  available: boolean;
  friends: Friend[];
  /** Friend or requester id → a link to their photo, good for an hour. */
  photos: Record<string, string>;
  /** Requests waiting for your answer. */
  requests: FriendRequest[];
  /** False when the server hasn't had supabase/people.sql run, so finding people stays hidden. */
  peopleReady: boolean;
  loading: boolean;
  error: string | null;
  /** Fetches everything again; with `quiet`, without showing a spinner. */
  refresh: (quiet?: boolean) => Promise<void>;
  forgetRequest: (id: string) => void;
  byId: (id: string) => Friend | undefined;
};

const Ctx = createContext<FriendsContext | null>(null);

type Loaded = { owner: string; friends: Friend[]; photos: Record<string, string>; requests: FriendRequest[]; peopleReady: boolean };

// Coming back to the app after this long fetches everything again: requests and acceptances arrive from
// other phones, and photo links last an hour.
const FRESH_MS = 2 * 60 * 1000;

async function load(owner: string): Promise<Loaded> {
  const [friends, waiting] = await Promise.all([
    myFriends(),
    friendRequests()
      .then((requests) => ({ requests, peopleReady: true }))
      .catch((e: unknown) => ({ requests: [] as FriendRequest[], peopleReady: !notSetUp(e) })),
  ]);
  const links = await Promise.all([...friends, ...waiting.requests].map(async (f) => [f.id, f.photoPath ? await photoUrl(f.photoPath) : null] as const));
  const photos: Record<string, string> = {};
  for (const [id, url] of links) if (url) photos[id] = url;
  rememberFriends(waiting.requests, friends).catch(() => {});
  return { owner, friends, photos, ...waiting };
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
  const loadedAt = useRef(0);

  // Signing in (or into another account) loads that account's friends.
  useEffect(() => {
    if (!email) return;
    let live = true;
    load(email)
      .then((r) => {
        if (!live) return;
        loadedAt.current = Date.now();
        setState(r);
      })
      .catch((e) => live && setFailure({ owner: email, error: message(e) }));
    return () => {
      live = false;
    };
  }, [email]);

  const refresh = useCallback(
    async (quiet = false) => {
      if (!email) return;
      if (!quiet) setRefreshing(true);
      try {
        const next = await load(email);
        loadedAt.current = Date.now();
        setState(next);
        setFailure(null);
      } catch (e) {
        // A quiet refresh keeps what's on screen; only a problem you asked about is shown.
        if (!quiet) setFailure({ owner: email, error: message(e) });
      } finally {
        if (!quiet) setRefreshing(false);
      }
    },
    [email],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - loadedAt.current > FRESH_MS) refresh(true).catch(() => {});
    });
    return () => sub.remove();
  }, [refresh]);

  const forgetRequest = useCallback((id: string) => {
    setState((s) => (s ? { ...s, requests: s.requests.filter((r) => r.id !== id) } : s));
  }, []);

  const value = useMemo<FriendsContext>(() => {
    const friends = current?.friends ?? [];
    return {
      available,
      friends,
      photos: current?.photos ?? {},
      requests: current?.requests ?? [],
      peopleReady: current?.peopleReady ?? true,
      loading,
      error,
      refresh,
      forgetRequest,
      byId: (id) => friends.find((f) => f.id === id),
    };
  }, [available, current, loading, error, refresh, forgetRequest]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFriends() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFriends must be used inside FriendsProvider');
  return ctx;
}
