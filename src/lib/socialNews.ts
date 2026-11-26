// Likes and comments on diary entries, put into words for alerts and the Friends page.

/** Something that happened on an entry: a like or comment on yours, or a reply after your comment. */
export type SocialNews = {
  kind: 'like' | 'comment' | 'reply' | 'also';
  id: string;
  ownerId: string;
  entryId: string;
  whoId: string;
  who: string;
  title: string;
  body: string | null;
  at: string;
};

const MOST_WORDS = 140;

/** A comment cut to fit a notification, on a word where it can. */
export function excerpt(body: string, most = MOST_WORDS): string {
  const one = body.replace(/\s+/g, ' ').trim();
  if (one.length <= most) return one;
  const cut = one.slice(0, most);
  const space = cut.lastIndexOf(' ');
  return `${(space > most * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '')}…`;
}

/** Its heading and line. `title` is the film or show; an entry without one is "your entry". */
export function newsText(n: SocialNews): { title: string; body: string } {
  const what = n.title || (n.kind === 'like' || n.kind === 'comment' ? 'your entry' : 'an entry');
  switch (n.kind) {
    case 'like':
      return { title: `${n.who} liked your entry`, body: what };
    case 'comment':
      return { title: `${n.who} commented on ${what}`, body: excerpt(n.body ?? '') };
    case 'reply':
      return { title: `${n.who} replied on ${what}`, body: excerpt(n.body ?? '') };
    default:
      return { title: `${n.who} also commented on ${what}`, body: excerpt(n.body ?? '') };
  }
}

/** Where tapping it goes: your own entry, or the friend's entry page. */
export function newsRoute(n: Pick<SocialNews, 'ownerId' | 'entryId'>, me: string | null): string {
  return n.ownerId === me ? `/entry/${encodeURIComponent(n.entryId)}` : `/friend-entry/${encodeURIComponent(n.entryId)}?owner=${encodeURIComponent(n.ownerId)}`;
}

/** The ones not announced before, oldest first, at most `most`; and every id to remember after. */
export function unannounced(news: SocialNews[], seen: string[], most = 5): { fresh: SocialNews[]; remember: string[] } {
  const known = new Set(seen);
  const fresh = news.filter((n) => !known.has(n.id)).sort((a, b) => a.at.localeCompare(b.at));
  // Remember a bounded list: the current window plus the most recent of the old ones.
  const remember = [...new Set([...news.map((n) => n.id), ...seen])].slice(0, 300);
  return { fresh: fresh.slice(-most), remember };
}

/** "now", "5m", "3h", "2d", or the date, for a comment's corner. */
export function shortAgo(iso: string, now = Date.now()): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 60_000) return 'now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const date = new Date(Date.parse(iso));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}
