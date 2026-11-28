// Emoji reactions on comments and replies (supabase/comment-reactions.sql) and on entries (entry-reactions.sql,
// where the like is the heart): the set offered, and how a pick changes what shows. Plain logic, shared with
// watchheart.in and the tests.

/** The reactions offered on a comment, in this order. The server takes only these. */
export const COMMENT_REACTIONS = ['❤️', '😂', '😮', '😢', '🍿', '🔥'] as const;
/** One emoji on a comment: how many, and whether one of them is yours. */
export type Reaction = { emoji: string; count: number; mine: boolean };

/** Most first, then in the picker's order. */
export function sortReactions(list: Reaction[]): Reaction[] {
  const at = (e: string) => COMMENT_REACTIONS.indexOf(e as (typeof COMMENT_REACTIONS)[number]);
  return [...list].sort((a, b) => b.count - a.count || at(a.emoji) - at(b.emoji));
}

/** The emoji you have on it now, if any. */
export const myReaction = (list: Reaction[] | undefined) => list?.find((r) => r.mine)?.emoji ?? null;

/**
 * The reactions after you pick `emoji`: yours moves to it, or comes off when it was already that one.
 * Returns the new list and what to send (null = take it off).
 */
export function pickReaction(list: Reaction[] | undefined, emoji: string): { list: Reaction[]; send: string | null } {
  const had = myReaction(list);
  const send = had === emoji ? null : emoji;
  let next = (list ?? []).map((r) => (r.mine ? { ...r, mine: false, count: r.count - 1 } : r)).filter((r) => r.count > 0);
  if (send) {
    const there = next.find((r) => r.emoji === send);
    next = there ? next.map((r) => (r === there ? { ...r, mine: true, count: r.count + 1 } : r)) : [...next, { emoji: send, count: 1, mine: true }];
  }
  return { list: sortReactions(next), send };
}

// --- Reactions on an entry ---------------------------------------------------------------------------------------
// Each like has an emoji; a plain like is the heart, so the like count counts every reaction.

/** The like itself. */
export const LIKE = '❤️';
type Liked = { likes: number; liked: boolean; reactions?: Reaction[] };

/** An entry's reactions. Before the server knew emoji (or for an older like), every like is a heart. */
export function entryReactions(s: Liked | undefined): Reaction[] {
  if (!s) return [];
  if (s.reactions?.length) return s.reactions;
  return s.likes > 0 ? [{ emoji: LIKE, count: s.likes, mine: s.liked }] : [];
}

/** Your reaction on an entry: an emoji (the heart for a plain like), or null. */
export const myEntryReaction = (s: Liked | undefined) => myReaction(entryReactions(s));

/** Whether there's more than hearts on it, so the emoji are worth showing. */
export const hasOtherReactions = (list: Reaction[]) => list.some((r) => r.emoji !== LIKE);

/**
 * The entry's counts after you pick `emoji` (tapping Like picks the heart, or yours again to take it off).
 * Returns them and what to send (null = take it off).
 */
export function pickEntryReaction<T extends Liked>(s: T, emoji: string): { next: T; send: string | null } {
  const { list, send } = pickReaction(entryReactions(s), emoji);
  return { next: { ...s, reactions: list, likes: list.reduce((n, r) => n + r.count, 0), liked: !!send }, send };
}

/** What tapping Like picks: your reaction (to take it off), or the heart. */
export const likeTap = (s: Liked | undefined) => myEntryReaction(s) ?? LIKE;
