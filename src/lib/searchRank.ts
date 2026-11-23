// Search results, best first: how closely the name matches what was typed, then how much people watch it
// (TMDB's popularity, when known), then each service's own order. So "dune" gives Dune, Dune: Part Two and
// Dune: Prophecy before a little-known film that happens to be called Dune too, and well before a series that
// only has "d'une" in its name. Shared with the website (Watch Heart Web src/data/searchAll.ts), so the app and
// watchheart.in order a search the same way.

/** Lower case, accents off, punctuation to spaces: "Amélie!" and "amelie" fold the same. */
export function fold(s: string) {
  let t = s;
  try {
    t = t.normalize('NFKD');
  } catch {
    // Without normalize, accents just stay.
  }
  return t
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s!-/:-@[-`{-~ -¿ -⁯]+/g, ' ')
    .trim();
}

/** How closely a name matches what was typed: the whole name, its start, a whole word, or anywhere. */
export function closeness(name: string | null | undefined, q: string): number {
  if (!name) return 0;
  const n = fold(name);
  if (n === q) return 60;
  if (n.startsWith(`${q} `)) return 48;
  if (n.startsWith(q)) return 40;
  if (` ${n} `.includes(` ${q} `)) return 28;
  if (n.includes(q)) return 10;
  return 0;
}

export type Rankable = { sourceId: string; title: string; originalTitle?: string | null; posterUrl?: string | null };

/**
 * One or more result lists (one per kind or service) merged, each title once, best first. `popularity` is
 * TMDB's number by sourceId ("movie:603"); without it, each list's own order counts for more.
 */
export function rank<T extends Rankable>(lists: T[][], query: string, popularity: Map<string, number> = new Map(), limit = 60): T[] {
  const q = fold(query);
  const seen = new Set<string>();
  const scored: { t: T; score: number; order: number }[] = [];
  lists.forEach((list, k) =>
    list.forEach((t, i) => {
      if (seen.has(t.sourceId)) return;
      seen.add(t.sourceId);
      const match = Math.max(closeness(t.title, q), closeness(t.originalTitle, q) * 0.9);
      const known = popularity.get(t.sourceId);
      const watched = known === undefined ? 0 : Math.min(48, Math.log10(known + 1) * 20);
      const place = Math.max(0, (popularity.size ? 12 : 30) - i * (popularity.size ? 1 : 2.5));
      const art = t.posterUrl ? 4 : -12;
      scored.push({ t, score: match + watched + place + art, order: i * lists.length + k });
    }),
  );
  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((s) => s.t);
}
