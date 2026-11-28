// Emoji reactions on comments and replies (supabase/comment-reactions.sql): the set offered, and how a pick
// changes what a comment shows. Plain logic, shared with watchheart.in and the tests.

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
