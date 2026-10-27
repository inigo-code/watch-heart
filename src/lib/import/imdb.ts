import type { MediaKind } from '@/store/types';

import { halfStars, importedEntry, importedWatch, records, toDay, yearOf } from './common';
import type { ImportResult, Row } from './common';

// IMDb (imdb.com → Your Ratings / Your Watchlist → ⋯ → Export). Two CSVs, both with the IMDb id ("Const"),
// which matches TMDB exactly:
// - ratings: every title you rated, dated the day you rated it (IMDb doesn't record watch dates)
// - watchlist: goes to the Watchlist
// Individual episode ratings are left out; the diary logs shows, not single episodes.

/** Which IMDb export a CSV is, from its columns. */
export function imdbKind(headers: string[]): 'ratings' | 'watchlist' | null {
  if (!headers.includes('Const')) return null;
  if (headers.includes('Your Rating') && headers.includes('Date Rated') && !headers.includes('Position')) return 'ratings';
  if (headers.includes('Position') || headers.includes('Created')) return 'watchlist';
  return null;
}

function kindOf(r: Row): MediaKind | null {
  const type = (r['Title Type'] ?? '').toLowerCase();
  if (type.includes('episode')) return null;
  return /series|mini/.test(type) ? 'tv' : 'movie';
}

const genres = (r: Row) => (r.Genres ?? '').split(',').map((g) => g.trim()).filter(Boolean);

export function fromImdb(csv: string): ImportResult {
  const { headers, rows } = records(csv);
  const kind = imdbKind(headers);
  if (kind === 'ratings') {
    const entries = rows.flatMap((r) => {
      const k = kindOf(r);
      if (!k || !r.Const || !r.Title) return [];
      return [
        importedEntry(`imdb-${r.Const}`, {
          kind: k,
          title: r.Title,
          originalTitle: r['Original Title'] && r['Original Title'] !== r.Title ? r['Original Title'] : null,
          year: yearOf(r.Year),
          watchedOn: toDay(r['Date Rated']),
          rating: halfStars(r['Your Rating'], 10),
          genres: genres(r),
          runtime: Number(r['Runtime (mins)']) || null,
          credit: (r.Directors ?? '').split(',')[0]?.trim() || null,
          imdbId: r.Const,
        }),
      ];
    });
    return { entries, watchlist: [] };
  }
  if (kind === 'watchlist') {
    const watchlist = rows.flatMap((r) => {
      const k = kindOf(r);
      if (!k || !r.Const || !r.Title) return [];
      const added = toDay(r.Created);
      return [
        importedWatch(`imdbw-${r.Const}`, {
          kind: k,
          title: r.Title,
          year: yearOf(r.Year),
          genres: genres(r),
          runtime: Number(r['Runtime (mins)']) || null,
          note: r.Description ?? '',
          imdbId: r.Const,
          addedAt: added ? new Date(`${added}T12:00:00`).getTime() : Date.now(),
        }),
      ];
    });
    return { entries: [], watchlist };
  }
  return { entries: [], watchlist: [] };
}
