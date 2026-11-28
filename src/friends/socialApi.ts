import { LIKE, sortReactions } from '@/lib/reactions';
import type { Reaction } from '@/lib/reactions';
import type { SocialNews } from '@/lib/socialNews';
import type { Entry } from '@/store/types';
import { supabase } from '@/sync/supabase';

// Likes and comments on diary entries, through the functions in supabase/entry-social.sql: they check that
// you can see the entry (yours, or a friend's while they share their diary) and hide blocked people.
// Until that file has run on the server, reads come back empty and the app shows nothing for them.

/** `likes` counts every reaction (a plain like is the heart); `reactions` says which, once the server has them. */
export type Social = { likes: number; liked: boolean; comments: number; reactions?: Reaction[] };
export type Comment = { id: string; authorId: string; name: string; photoPath: string | null; body: string; at: string };
export type Liker = { id: string; name: string; photoPath: string | null; at: string; emoji?: string };
export type { Reaction, SocialNews };
const client = () => {
  if (!supabase) throw new Error('Friends aren’t available in this version of the app.');
  return supabase;
};

const missing = (m: string) => /function .* does not exist|Could not find the function/i.test(m);

/** Our own wording passes through; a missing server part reads as not available; anything else is the connection. */
function fail(e: { message?: string } | null): never {
  const m = e?.message ?? '';
  if (/Sign in first|Write something first|too long|isn’t shared with you|Too many comments|Too many reactions|Pick one of the reactions/.test(m)) throw new Error(m);
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
  const args = { owners: items.map((i) => i.ownerId), ids: items.map((i) => i.entryId) };
  const [{ data, error }, faces] = await Promise.all([client().rpc('entry_social', args), client().rpc('entry_reactions', args)]);
  if (error) {
    if (missing(error.message)) return {};
    fail(error);
  }
  // Which emoji: left out (all hearts) until entry-reactions.sql has run, or if that ask fails.
  const byEntry: Record<string, Reaction[]> = {};
  if (!faces.error)
    for (const r of (faces.data ?? []) as { owner_id: string; entry_id: string; emoji: string; count: number; mine: boolean }[])
      (byEntry[socialKey(r.owner_id, r.entry_id)] ??= []).push({ emoji: r.emoji, count: Number(r.count) || 0, mine: !!r.mine });
  const out: Record<string, Social> = {};
  for (const r of (data ?? []) as { owner_id: string; entry_id: string; likes: number; liked: boolean; comments: number }[]) {
    const key = socialKey(r.owner_id, r.entry_id);
    out[key] = { likes: Number(r.likes) || 0, liked: !!r.liked, comments: Number(r.comments) || 0, ...(faces.error ? {} : { reactions: sortReactions(byEntry[key] ?? []) }) };
  }
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

/** Who liked your entry, with their emoji once the server has them (only the owner gets names). */
export async function entryLikers(ownerId: string, entryId: string): Promise<Liker[]> {
  const faces = await client().rpc('entry_reactors', { owner: ownerId, entry: entryId });
  if (!faces.error)
    return ((faces.data ?? []) as { user_id: string; name: string; photo_path: string | null; emoji: string; created_at: string }[]).map((r) => ({
      id: r.user_id,
      name: r.name,
      photoPath: r.photo_path,
      at: r.created_at,
      emoji: r.emoji,
    }));
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

/** Sets your reaction to an entry (null takes it off; the heart is a plain like). Older servers take likes only. */
export async function reactEntry(ownerId: string, entryId: string, emoji: string | null): Promise<void> {
  const { error } = await client().rpc('react_entry', { owner: ownerId, entry: entryId, emoji });
  if (!error) return;
  if (!missing(error.message)) fail(error);
  if (emoji && emoji !== LIKE) throw new Error('Reactions aren’t available yet. Try again later.');
  await likeEntry(ownerId, entryId, !!emoji);
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

// --- Reactions on comments (supabase/comment-reactions.sql) ----------------------------------------------------

/** Every comment's reactions on an entry, by comment id. Empty until the server has them. */
export async function commentReactions(ownerId: string, entryId: string): Promise<Record<string, Reaction[]>> {
  const { data, error } = await client().rpc('comment_reaction_counts', { owner: ownerId, entry: entryId });
  if (error) {
    if (missing(error.message)) return {};
    fail(error);
  }
  const out: Record<string, Reaction[]> = {};
  for (const r of (data ?? []) as { comment_id: string; emoji: string; count: number; mine: boolean }[])
    (out[r.comment_id] ??= []).push({ emoji: r.emoji, count: Number(r.count) || 0, mine: !!r.mine });
  for (const k of Object.keys(out)) out[k] = sortReactions(out[k]);
  return out;
}

/** Sets your reaction to a comment (null takes it off). Returns the one now on it. */
export async function reactComment(commentId: string, emoji: string | null): Promise<string | null> {
  const { data, error } = await client().rpc('react_comment', { comment: commentId, emoji });
  if (error) {
    if (missing(error.message)) throw new Error('Reactions aren’t available yet. Try again later.');
    fail(error);
  }
  return (data as string | null) ?? null;
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
