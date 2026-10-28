import { fromHtml } from '@/lib/richText';
import type { Entry } from '@/store/types';

import { halfStars, hash, importedEntry, importedWatch, records, toDay } from './common';
import type { ImportResult, Row } from './common';

// Letterboxd export (letterboxd.com → Settings → Data → Export your data), a .zip of CSVs:
// - diary.csv: each logged viewing (date watched, rating, rewatch, tags)
// - reviews.csv: the same viewings with review text; reviews never logged in the diary become entries too
// - watched.csv + ratings.csv: films marked watched or rated without a diary log. Many people log only
//   some films, so these become entries too, dated the day they were marked watched (or rated).
// - likes/films.csv: films you hearted
// - watchlist.csv: goes to the Watchlist
// Other files (deleted/, orphaned/, lists/, likes/reviews.csv, comments…) aren't diary data.

export const LETTERBOXD_FILES = ['diary.csv', 'reviews.csv', 'watched.csv', 'ratings.csv', 'likes/films.csv', 'watchlist.csv'] as const;
export type LetterboxdFile = (typeof LETTERBOXD_FILES)[number];

/** Which export file a zip path is: exact names only, at the top of the export (any wrapping folder ignored). */
export function letterboxdFile(path: string): LetterboxdFile | null {
  const parts = path.replace(/\\/g, '/').toLowerCase().split('/').filter(Boolean);
  // Accept "diary.csv" or "letterboxd-name-2026-10-27/diary.csv", but not "deleted/diary.csv".
  for (const name of LETTERBOXD_FILES) {
    const want = name.split('/');
    const tail = parts.slice(-want.length);
    const above = parts.slice(0, -want.length);
    if (tail.join('/') === name && above.every((p) => p.startsWith('letterboxd'))) return name;
  }
  return null;
}

const filmKey = (r: Row) => `${(r.Name ?? '').toLowerCase()}|${r.Year ?? ''}`;
/** Letterboxd reviews carry a little HTML (<p>, <i>, <b>, <blockquote>); kept as Watch Heart's formatting. */
const plain = fromHtml;
const tagsOf = (r: Row) => (r.Tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);

export function fromLetterboxd(files: Partial<Record<LetterboxdFile, string>>): ImportResult {
  const rows = (name: LetterboxdFile) => records(files[name] ?? '').rows.filter((r) => r.Name);
  const liked = new Set(rows('likes/films.csv').map(filmKey));
  const ratingByFilm = new Map(rows('ratings.csv').map((r) => [filmKey(r), r]));
  const reviews = rows('reviews.csv');
  const reviewByUri = new Map(reviews.map((r) => [r['Letterboxd URI'], r]));
  const usedReviews = new Set<string>();
  const logged = new Set<string>();
  const entries: Entry[] = [];

  const add = (r: Row, watchedOn: string | null, review: string, ratingRow?: Row) => {
    if (!watchedOn) return;
    const id = `lb-${hash(r['Letterboxd URI'] || `${r.Name}|${r.Year}|${watchedOn}`)}`;
    if (entries.some((e) => e.id === id)) return;
    logged.add(filmKey(r));
    entries.push(
      importedEntry(id, {
        kind: 'movie',
        title: r.Name,
        year: Number(r.Year) || null,
        watchedOn,
        rating: halfStars((ratingRow ?? r).Rating, 5),
        liked: liked.has(filmKey(r)),
        rewatch: /^yes$/i.test(r.Rewatch ?? ''),
        review: plain(review),
        tags: tagsOf(r),
        createdAt: new Date(`${toDay(r.Date) ?? watchedOn}T12:00:00`).getTime(),
      }),
    );
  };

  // Diary viewings, with their review when there is one.
  for (const r of rows('diary.csv')) {
    const review = reviewByUri.get(r['Letterboxd URI']);
    if (review) usedReviews.add(r['Letterboxd URI']);
    add(r, toDay(r['Watched Date']) ?? toDay(r.Date), review?.Review ?? '');
  }
  // Reviews of viewings that aren't in diary.csv (or when only reviews.csv was picked).
  for (const r of reviews) {
    if (!usedReviews.has(r['Letterboxd URI'])) add(r, toDay(r['Watched Date']) ?? toDay(r.Date), r.Review ?? '');
  }
  // Watched or rated, never logged: dated when they were marked watched (or rated).
  const seenOnly = new Map<string, Row>();
  for (const r of [...rows('watched.csv'), ...rows('ratings.csv')]) if (!logged.has(filmKey(r)) && !seenOnly.has(filmKey(r))) seenOnly.set(filmKey(r), r);
  for (const r of seenOnly.values()) add(r, toDay(r.Date), '', ratingByFilm.get(filmKey(r)));

  const watchlist = rows('watchlist.csv').map((r) =>
    importedWatch(`lbw-${hash(r['Letterboxd URI'] || `${r.Name}|${r.Year}`)}`, {
      kind: 'movie',
      title: r.Name,
      year: Number(r.Year) || null,
      addedAt: new Date(`${toDay(r.Date) ?? '2000-01-01'}T12:00:00`).getTime(),
    }),
  );

  return { entries, watchlist };
}
