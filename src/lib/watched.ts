import { parseKey } from '@/lib/tracking';

type Viewing = { season?: number | null; episodes?: string[]; progress?: string; rating?: number; episodeRatings?: Record<string, number> };

/** What a viewing covered, in a few words: "Season 2", "S2 E4", "S2 E1–6", or what was typed by hand. */
export function watchedLabel(e: Viewing): string | null {
  if (e.season) return `Season ${e.season}`;
  const eps = (e.episodes ?? []).map(parseKey).filter((x) => x !== null);
  if (eps.length) {
    const seasons = new Set(eps.map((x) => x.season));
    if (seasons.size > 1) return `${eps.length} episodes`;
    const nums = eps.map((x) => x.number).sort((a, b) => a - b);
    const first = nums[0];
    const last = nums[nums.length - 1];
    if (nums.length === 1) return `S${eps[0].season} E${first}`;
    return last - first + 1 === nums.length ? `S${eps[0].season} E${first}–${last}` : `S${eps[0].season}, ${nums.length} episodes`;
  }
  return e.progress?.trim() || null;
}

/** The stars to show for a viewing: its own, or a single episode's. */
export function viewingRating(e: Viewing) {
  if (e.rating) return e.rating;
  return e.episodes?.length === 1 ? (e.episodeRatings?.[e.episodes[0]] ?? 0) : 0;
}
