import { aboutTmdb } from '@/api/tmdb';
import { sameTitle } from '@/store/DiaryStore';
import type { Entry, Title, WatchItem } from '@/store/types';

// What the Home tab suggests: titles like the ones you loved, leaving out what you've seen or saved.

/** The titles you rated highly or loved, newest first, one per title: the seeds for "For you". */
export function favouriteSeeds(entries: Entry[], max = 4): Entry[] {
  const seen = new Set<string>();
  return [...entries]
    .filter((e) => !e.deletedAt && e.source === 'tmdb' && e.sourceId && (e.rating >= 8 || e.liked))
    .sort((a, b) => b.watchedOn.localeCompare(a.watchedOn) || b.rating - a.rating)
    .filter((e) => (seen.has(e.sourceId) ? false : (seen.add(e.sourceId), true)))
    .slice(0, max);
}

/**
 * TMDB's recommendations for each seed, merged: a title suggested by several of your favourites comes first,
 * then by how high it sat in each list. Anything already in your diary or watchlist is left out.
 */
export async function forYou(key: string, seeds: Entry[], entries: Entry[], watchlist: WatchItem[], max = 20): Promise<Title[]> {
  const lists = await Promise.all(
    seeds.map((s) =>
      aboutTmdb(key, s.sourceId)
        .then((a) => a.recommendations)
        .catch(() => [] as Title[]),
    ),
  );
  const known = (t: Title) => entries.some((e) => !e.deletedAt && sameTitle(e, t)) || watchlist.some((w) => sameTitle(w, t));
  const score = new Map<string, { t: Title; points: number }>();
  for (const list of lists) {
    list.slice(0, 15).forEach((t, i) => {
      if (known(t)) return;
      const hit = score.get(t.sourceId) ?? { t, points: 0 };
      hit.points += 20 - i;
      score.set(t.sourceId, hit);
    });
  }
  return [...score.values()]
    .sort((a, b) => b.points - a.points)
    .slice(0, max)
    .map((x) => x.t);
}
