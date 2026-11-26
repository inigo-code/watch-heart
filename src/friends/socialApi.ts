import type { SocialNews } from '@/lib/socialNews';
import type { Entry } from '@/store/types';
import { supabase } from '@/sync/supabase';

// Likes and comments on diary entries, through the functions in supabase/entry-social.sql: they check that
// you can see the entry (yours, or a friend's while they share their diary) and hide blocked people.
// Until that file has run on the server, reads come back empty and the app shows nothing for them.

export type Social = { likes: number; liked: boolean; comments: number };
export type Comment = { id: string; authorId: string; name: string; photoPath: string | null; body: string; at: string };
export type Liker = { id: string; name: string; photoPath: string | null; at: string };
export type { SocialNews };
const client = () => {
  if (!supabase) throw new Error('Friends aren’t available in this version of the app.');
  return supabase;
};

const missing = (m: string) => /function .* does not exist|Could not find the function/i.test(m);

/** Our own wording passes through; a missing server part reads as not available; anything else is the connection. */
function fail(e: { message?: string } | null): never {
  const m = e?.message ?? '';
  if (/Sign in first|Write something first|too long|isn’t shared with you|Too many comments/.test(m)) throw new Error(m);
  if (missing(m)) throw new Error('Comments aren’t available yet. Try again later.');
  throw new Error(m || 'No connection. Try again in a moment.');
}

/** Your account id, from the saved sign-in (no network). */
export async function myId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export const socialKey = (ownerId: string, entryId: string) => `${ownerId}/${entryId}`;

/** Counts for many entries at once, keyed by socialKey. Empty when the server doesn't have them yet. */
export async function entrySocial(items: { ownerId: string; entryId: string }[]): Promise<Record<string, Social>> {
  if (!items.length) return {};
  const { data, error } = await client().rpc('entry_social', { owners: items.map((i) => i.ownerId), ids: items.map((i) => i.entryId) });
  if (error) {
    if (missing(error.message)) return {};
    fail(error);
  }
  const out: Record<string, Social> = {};
  for (const r of (data ?? []) as { owner_id: string; entry_id: string; likes: number; liked: boolean; comments: number }[])
    out[socialKey(r.owner_id, r.entry_id)] = { likes: Number(r.likes) || 0, liked: !!r.liked, comments: Number(r.comments) || 0 };
  return out;
}

export async function entryThread(ownerId: string, entryId: string): Promise<Comment[]> {
  const { data, error } = await client().rpc('entry_thread', { owner: ownerId, entry: entryId });
  if (error) {
    if (missing(error.message)) return [];
    fail(error);
  }
  return ((data ?? []) as { id: string; author_id: string; name: string; photo_path: string | null; body: string; created_at: string }[]).map((r) => ({
    id: r.id,
    authorId: r.author_id,
    name: r.name,
    photoPath: r.photo_path,
    body: r.body,
    at: r.created_at,
  }));
}

/** Who liked your entry (only the owner gets names). */
export async function entryLikers(ownerId: string, entryId: string): Promise<Liker[]> {
  const { data, error } = await client().rpc('entry_likers', { owner: ownerId, entry: entryId });
  if (error) {
    if (missing(error.message)) return [];
    fail(error);
  }
  return ((data ?? []) as { user_id: string; name: string; photo_path: string | null; created_at: string }[]).map((r) => ({
    id: r.user_id,
    name: r.name,
    photoPath: r.photo_path,
    at: r.created_at,
  }));
}

/** A friend's entry as they share it, or null when it's gone or no longer shared with you. */
export async function friendEntry(ownerId: string, entryId: string): Promise<Entry | null> {
  const { data, error } = await client().rpc('friend_entry', { owner: ownerId, entry: entryId });
  if (error) fail(error);
  return (data as Entry | null) ?? null;
}

export async function likeEntry(ownerId: string, entryId: string, on: boolean): Promise<void> {
  const { error } = await client().rpc('like_entry', { owner: ownerId, entry: entryId, on_off: on });
  if (error) fail(error);
}

export async function addComment(ownerId: string, entryId: string, words: string): Promise<string> {
  const { data, error } = await client().rpc('add_comment', { owner: ownerId, entry: entryId, words });
  if (error) fail(error);
  return data as string;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await client().rpc('delete_comment', { comment: id });
  if (error) fail(error);
}

/** What's happened on entries since then (30 days at most), newest first. */
export async function socialNews(since: string | null): Promise<SocialNews[]> {
  const { data, error } = await client().rpc('social_news', { since });
  if (error) {
    if (missing(error.message)) return [];
    fail(error);
  }
  return ((data ?? []) as { kind: SocialNews['kind']; id: string; owner_id: string; entry_id: string; who_id: string; who: string; title: string; body: string | null; at: string }[]).map(
    (r) => ({ kind: r.kind, id: r.id, ownerId: r.owner_id, entryId: r.entry_id, whoId: r.who_id, who: r.who, title: r.title, body: r.body, at: r.at }),
  );
}
