import type { MediaKind } from '@/store/types';

// What the search box on Find suggests: something from your own watchlist first, then what's trending
// that you haven't logged, then a plain word. The pick holds for the day, so it doesn't jump around.

type Waiting = { kind: MediaKind; title: string; track?: { status: string } };
type Trending = { title: string; seen: boolean };

const MOST_LETTERS = 18;
const PLAIN: Record<MediaKind, string> = { movie: 'Search films', tv: 'Search series', anime: 'Search anime' };

const short = (title: string) => (title.length > MOST_LETTERS ? `${title.slice(0, MOST_LETTERS - 1).trimEnd()}…` : title);
const ofTheDay = <T>(list: T[], day: number) => list[day % list.length];

export function searchHint(kind: MediaKind, watchlist: Waiting[], trending: Trending[], day: number): string {
  const yours = watchlist.filter((w) => w.kind === kind && (!w.track || w.track.status === 'watching' || w.track.status === 'paused'));
  if (yours.length) {
    const pick = ofTheDay(yours, day);
    return pick.track ? `Back to “${short(pick.title)}”?` : `Seen “${short(pick.title)}” yet?`;
  }
  const fresh = trending.filter((t) => !t.seen);
  if (fresh.length) return `Trending: “${short(ofTheDay(fresh, day).title)}”`;
  return PLAIN[kind];
}
