import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { useDiary } from '@/store/DiaryStore';
import type { RemoteRecord, SyncStoreApi } from '@/store/DiaryStore';
import type { Entry, WatchItem } from '@/store/types';

import { AUTO_SYNC_COOLDOWN_MS, createAutoSync } from './autoSync';
import { supabase } from './supabase';

const PAGE = 1000;
const LOCAL_DEBOUNCE_MS = 1500;
const RETRY_MS = 30_000;
// Pull a little before the last cursor: rows committed by slower transactions can carry slightly
// older server timestamps. Applying is idempotent, so re-reading a few rows is harmless.
const PULL_OVERLAP_MS = 10_000;

type Table = 'entries' | 'watchlist';
type Row = { id: string; data: unknown; modified_at: number | string; removed: boolean; server_updated_at?: string };

/** `waiting`: synced before, but local changes are queued for the next sync (see `nextSyncAt`). */
export type SyncStatus = 'unconfigured' | 'signed-out' | 'idle' | 'syncing' | 'waiting' | 'synced' | 'error';

type SyncContext = {
  status: SyncStatus;
  error: string | null;
  lastSyncedAt: number | null;
  email: string | null;
  /** Changes on this phone that haven't reached the cloud yet. */
  unsentCount: number;
  /** When the next automatic sync is planned (ms timestamp), or null. */
  nextSyncAt: number | null;
  /** Resolves when the sync finishes. */
  syncNow: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Resolves to true when signed in straight away, false if Supabase wants the email confirmed first. */
  signUp: (email: string, password: string) => Promise<boolean>;
  /** Confirms a new account with the code from the sign-up email (when "Confirm email" is on). */
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendSignUpCode: (email: string) => Promise<void>;
  /** Emails a code for choosing a new password. */
  sendPasswordReset: (email: string) => Promise<void>;
  /** Signs in with the emailed code and sets the new password. */
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  /** Signs out; with `removeLocal`, also empties the diary and watchlist on this phone (the account keeps them). */
  signOut: (removeLocal: boolean) => Promise<void>;
  /** Deletes the account and everything in it from the cloud, then signs out. The phone keeps its copy. */
  deleteAccount: () => Promise<void>;
};

const Ctx = createContext<SyncContext | null>(null);

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

/** Rows for every record changed here: the record itself, or a tombstone if it's gone. */
function rowsFor<T extends { id: string }>(pending: Record<string, number>, records: T[], userId: string) {
  const byId = new Map(records.map((r) => [r.id, r]));
  return Object.entries(pending).map(([id, at]) => {
    const record = byId.get(id);
    return { user_id: userId, id, data: record ?? {}, modified_at: at, removed: !record };
  });
}

async function push(client: SupabaseClient, userId: string, store: SyncStoreApi, sent: Map<string, number>) {
  const { entries, watchlist, meta } = store.getSnapshot();
  const plan: [Table, ReturnType<typeof rowsFor>][] = [
    ['entries', rowsFor(meta.entries, entries, userId)],
    ['watchlist', rowsFor(meta.watchlist, watchlist, userId)],
  ];
  for (const [table, rows] of plan) {
    for (const batch of chunks(rows, 500)) {
      const { error } = await client.from(table).upsert(batch, { onConflict: 'user_id,id' });
      if (error) throw error;
      for (const r of batch) sent.set(`${table}:${r.id}`, r.modified_at);
    }
  }
  store.markPushed({ entries: { ...meta.entries }, watchlist: { ...meta.watchlist } });
}

async function pullTable(client: SupabaseClient, table: Table, userId: string, since: string | null): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = client.from(table).select('id, data, modified_at, removed, server_updated_at').eq('user_id', userId);
    if (since) q = q.gt('server_updated_at', since);
    const { data, error } = await q.order('server_updated_at').order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data as Row[]));
    if (data.length < PAGE) return out;
  }
}

// Fills in fields a record from an older app version may not have.
const ENTRY_DEFAULTS: Omit<Entry, 'id'> = {
  kind: 'movie', source: 'manual', sourceId: '', title: '', originalTitle: null, year: null, posterUrl: null, backdropUrl: null,
  genres: [], runtime: null, credit: null, watchedOn: '1970-01-01', rating: 0, liked: false, rewatch: false, progress: '', review: '',
  spoilers: false, tags: [], createdAt: 0, updatedAt: 0, deletedAt: null,
};
const WATCH_DEFAULTS: Omit<WatchItem, 'id'> = {
  kind: 'movie', source: 'manual', sourceId: '', title: '', originalTitle: null, year: null, posterUrl: null, backdropUrl: null,
  genres: [], runtime: null, credit: null, note: '', addedAt: 0,
};

function toRecord<T>(r: Row, defaults: Omit<T, 'id'>): RemoteRecord<T> {
  return { id: r.id, data: { ...defaults, ...(r.data as object), id: r.id } as T, modifiedAt: Number(r.modified_at), removed: r.removed };
}

async function pull(client: SupabaseClient, userId: string, store: SyncStoreApi) {
  const cursor = store.getSnapshot().meta.lastPulledAt;
  const since = cursor ? new Date(Date.parse(cursor) - PULL_OVERLAP_MS).toISOString() : null;
  const [entryRows, watchRows] = await Promise.all([pullTable(client, 'entries', userId, since), pullTable(client, 'watchlist', userId, since)]);

  let newest = cursor;
  for (const r of [...entryRows, ...watchRows]) {
    if (r.server_updated_at && (!newest || Date.parse(r.server_updated_at) > Date.parse(newest))) newest = r.server_updated_at;
  }
  store.applyRemote(
    {
      entries: entryRows.map((r) => toRecord<Entry>(r, ENTRY_DEFAULTS)),
      watchlist: watchRows.map((r) => toRecord<WatchItem>(r, WATCH_DEFAULTS)),
    },
    newest,
  );
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { ready, sync: store } = useDiary();
  const { meta, localRevision, resetForUser, forgetAccount, clearLocal } = store;
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<{ status: 'idle' | 'syncing' | 'synced' | 'error'; error: string | null; lastSyncedAt: number | null }>({
    status: 'idle',
    error: null,
    lastSyncedAt: null,
  });
  const userId = session?.user.id ?? null;
  // Sync only once the store has been switched over to this account.
  const active = ready && userId !== null && meta.userId === userId;

  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  });
  // What this phone last sent, so its own changes coming back over the live channel don't trigger a sync.
  const sent = useRef(new Map<string, number>());
  const running = useRef(false);
  const again = useRef(false);
  // Automatic syncs go through the cooldown; manual ones (syncNow) call runSync directly.
  const runSyncRef = useRef<() => Promise<void>>(async () => {});
  const [nextSyncAt, setNextSyncAt] = useState<number | null>(null);
  const [autoSync] = useState(() => createAutoSync(() => void runSyncRef.current(), AUTO_SYNC_COOLDOWN_MS, undefined, setNextSyncAt));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (ready && userId && meta.userId !== userId) resetForUser(userId);
  }, [ready, userId, meta.userId, resetForUser]);

  const runSync = useCallback(async () => {
    if (!supabase || !userId) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    autoSync.started();
    setState((s) => ({ ...s, status: 'syncing' }));
    try {
      do {
        again.current = false;
        await push(supabase, userId, storeRef.current, sent.current);
        await pull(supabase, userId, storeRef.current);
      } while (again.current);
      setState({ status: 'synced', error: null, lastSyncedAt: Date.now() });
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: errorText(e) }));
    } finally {
      running.current = false;
      autoSync.finished();
    }
  }, [userId, autoSync]);

  useEffect(() => {
    runSyncRef.current = runSync;
  }, [runSync]);

  // Nothing automatic while signed out, or after unmounting.
  useEffect(() => {
    if (!active) autoSync.cancel();
  }, [active, autoSync]);
  useEffect(() => () => autoSync.cancel(), [autoSync]);

  // On sign-in straight away, and after local changes, at most once per cooldown.
  useEffect(() => {
    if (active) autoSync.request(localRevision === 0 ? 0 : LOCAL_DEBOUNCE_MS);
  }, [active, localRevision, autoSync]);

  // Coming back to the app syncs (after the cooldown); leaving it sends anything unsent right away,
  // so your other devices see the change.
  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (s) => {
      const m = storeRef.current.getSnapshot().meta;
      if (s === 'active') autoSync.request();
      else if (s === 'background' && Object.keys(m.entries).length + Object.keys(m.watchlist).length > 0) void runSync();
    });
    return () => sub.remove();
  }, [active, autoSync, runSync]);

  // Live updates from other devices. This phone's own uploads coming back are ignored.
  useEffect(() => {
    if (!active || !supabase || !userId) return;
    const client = supabase;
    const onChange = (table: Table) => (payload: { new?: unknown }) => {
      const r = payload.new as Partial<Row> | undefined;
      if (r?.id && sent.current.get(`${table}:${r.id}`) === Number(r.modified_at)) return;
      autoSync.request(400);
    };
    const channel = client
      .channel(`sync-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `user_id=eq.${userId}` }, onChange('entries'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watchlist', filter: `user_id=eq.${userId}` }, onChange('watchlist'))
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [active, userId, autoSync]);

  // Retry after a failure (offline, server hiccup).
  useEffect(() => {
    if (active && state.status === 'error') autoSync.request(RETRY_MS);
  }, [active, state.status, autoSync]);

  const client = useCallback(() => {
    if (!supabase) throw new Error('Cloud sync is not configured.');
    return supabase;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, [client]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await client().auth.signUp({ email: email.trim(), password });
    if (error) throw error;
    return data.session !== null;
  }, [client]);

  // The email codes need {{ .Token }} in the Supabase "Confirm signup" and "Reset password" email
  // templates; see supabase/SETUP.md.
  const confirmSignUp = useCallback(async (email: string, code: string) => {
    const { error } = await client().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'signup' });
    if (error) throw error;
  }, [client]);

  const resendSignUpCode = useCallback(async (email: string) => {
    const { error } = await client().auth.resend({ type: 'signup', email: email.trim() });
    if (error) throw error;
  }, [client]);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await client().auth.resetPasswordForEmail(email.trim());
    if (error) throw error;
  }, [client]);

  const resetPassword = useCallback(async (email: string, code: string, password: string) => {
    const c = client();
    const { error } = await c.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
    if (error) throw error;
    const { error: updateError } = await c.auth.updateUser({ password });
    if (updateError) throw updateError;
  }, [client]);

  const signOut = useCallback(
    async (removeLocal: boolean) => {
      // Send anything unsent first, so nothing is lost if this phone's copy is removed.
      const m = storeRef.current.getSnapshot().meta;
      if (Object.keys(m.entries).length + Object.keys(m.watchlist).length > 0) {
        await runSync();
        const left = storeRef.current.getSnapshot().meta;
        if (removeLocal && Object.keys(left.entries).length + Object.keys(left.watchlist).length > 0) {
          throw new Error('Some changes haven’t reached the cloud yet. Connect to the internet and try again.');
        }
      }
      await client().auth.signOut({ scope: 'local' });
      forgetAccount();
      if (removeLocal) clearLocal();
      setState({ status: 'idle', error: null, lastSyncedAt: null });
    },
    [client, runSync, forgetAccount, clearLocal],
  );

  const deleteAccount = useCallback(async () => {
    const c = client();
    if (!userId) throw new Error('Sign in first.');
    const { error } = await c.rpc('delete_my_account');
    if (error) {
      throw new Error(
        /delete_my_account/.test(error.message) ? "Account deletion isn't set up on the server yet (run supabase/schema.sql)." : error.message,
      );
    }
    await c.auth.signOut({ scope: 'local' }).catch(() => {});
    forgetAccount();
    setState({ status: 'idle', error: null, lastSyncedAt: null });
  }, [client, userId, forgetAccount]);

  const unsentCount = Object.keys(meta.entries).length + Object.keys(meta.watchlist).length;

  const value = useMemo<SyncContext>(
    () => ({
      status: !supabase
        ? 'unconfigured'
        : !userId
          ? 'signed-out'
          : (state.status === 'synced' || state.status === 'idle') && unsentCount > 0
            ? 'waiting'
            : state.status,
      error: state.error,
      lastSyncedAt: state.lastSyncedAt,
      email: session?.user.email ?? null,
      unsentCount,
      nextSyncAt: userId ? nextSyncAt : null,
      syncNow: runSync,
      signIn,
      signUp,
      confirmSignUp,
      resendSignUpCode,
      sendPasswordReset,
      resetPassword,
      signOut,
      deleteAccount,
    }),
    [userId, session, state, unsentCount, nextSyncAt, runSync, signIn, signUp, confirmSignUp, resendSignUpCode, sendPasswordReset, resetPassword, signOut, deleteAccount],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSync must be used inside SyncProvider');
  return ctx;
}
