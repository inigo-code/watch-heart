// Writes demo-backup.json: a made-up diary and watchlist for the store screenshots.
// `cdp.mjs seed` puts it into the web build (or restore it in the app: Settings → Backup → Restore). Every
// title is "manual", so the app itself finds each one on TMDB by name and year and fills in the posters.
// Nothing here is anyone's real diary; the stars and lines are the demo diary's own, not quotes.
// Frieren isn't here: its entries come from ticking episodes (see README.md).
//
//   node store/make/demo.mjs [YYYY-MM-DD]     (the day the screens are taken; default today)

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const today = process.argv[2] ? new Date(`${process.argv[2]}T12:00:00`) : new Date();
const day = (back) => {
  const d = new Date(today);
  d.setDate(d.getDate() - back);
  return d.toLocaleDateString('en-CA');
};

// [days ago, kind, title, year, half stars, heart, extras]
const diary = [
  [1, 'movie', 'Perfect Days', 2023, 9, true, { review: 'Toilets, trees and Lou Reed. I want to live like Hirayama for a week.', device: 'cinema', vibes: ['Slow burn', 'Comfort watch'] }],
  [2, 'tv', 'Severance', 2022, 9, false, { progress: 'Season 2', season: 2 }],
  [3, 'movie', 'Manjummel Boys', 2024, 8, false, { review: 'The cave scenes had the whole hall holding its breath.', device: 'cinema' }],
  [5, 'movie', 'Past Lives', 2023, 10, true, { review: 'In-yun. That bar scene at the end.', rewatch: true }],
  [7, 'anime', 'The Apothecary Diaries', 2023, 8, false, { progress: 'Season 1' }],
  [8, 'movie', 'Godzilla Minus One', 2023, 8, false, {}],
  [10, 'movie', 'Anatomy of a Fall', 2023, 9, false, { review: 'The dog deserves every award.' }],
  [12, 'tv', 'Panchayat', 2020, 9, true, { progress: 'Season 3', season: 3 }],
  [14, 'movie', 'Spirited Away', 2001, 10, true, { rewatch: true, vibes: ['Comfort watch'] }],
  [16, 'movie', 'Aavesham', 2024, 8, false, {}],
  [19, 'movie', 'The Holdovers', 2023, 8, false, {}],
  [21, 'movie', 'Dune: Part Two', 2024, 9, false, { device: 'cinema' }],
  [24, 'tv', 'The Bear', 2022, 9, true, { progress: 'Season 1', season: 1 }],
  [26, 'movie', 'Aftersun', 2022, 9, true, { review: 'Under Pressure will never sound the same.' }],
  [29, 'anime', 'Jujutsu Kaisen', 2020, 8, false, { progress: 'Season 2', season: 2 }],
  [31, 'movie', 'Your Name.', 2016, 9, true, {}],
  [34, 'movie', '12th Fail', 2023, 9, true, {}],
  [37, 'tv', 'Shōgun', 2024, 9, false, { progress: 'Season 1', season: 1 }],
  [40, 'movie', 'Spider-Man: Across the Spider-Verse', 2023, 9, false, {}],
  [43, 'movie', 'Parasite', 2019, 10, true, { rewatch: true }],
  [46, 'movie', 'In the Mood for Love', 2000, 9, false, {}],
  [50, 'tv', 'Arcane', 2021, 9, true, { progress: 'Season 2', season: 2 }],
];

const watchlist = [
  ['movie', 'All We Imagine as Light', 2024],
  ['movie', 'The Brutalist', 2024],
  ['movie', 'Nosferatu', 2024],
  ['tv', 'Pachinko', 2022],
  ['anime', 'Vinland Saga', 2019],
  ['movie', 'Close', 2022],
  ['tv', 'Blue Eye Samurai', 2023],
  ['movie', 'The Zone of Interest', 2023],
  ['movie', 'Drive My Car', 2021],
];

const now = today.getTime();
const blank = { source: 'manual', sourceId: '', originalTitle: null, posterUrl: null, backdropUrl: null, genres: [], runtime: null, credit: null };

const entries = diary.map(([back, kind, title, year, rating, liked, x], i) => ({
  id: `demo-entry-${String(i + 1).padStart(2, '0')}`,
  kind,
  ...blank,
  title,
  year,
  watchedOn: day(back),
  rating,
  liked,
  rewatch: !!x.rewatch,
  progress: x.progress ?? '',
  review: x.review ?? '',
  spoilers: false,
  tags: [],
  createdAt: now - back * 86400000,
  updatedAt: now - back * 86400000,
  deletedAt: null,
  season: x.season ?? null,
  vibes: x.vibes ?? [],
  device: x.device ?? null,
}));

const items = watchlist.map(([kind, title, year], i) => ({
  id: `demo-watch-${String(i + 1).padStart(2, '0')}`,
  kind,
  ...blank,
  title,
  year,
  note: '',
  addedAt: now - (i + 1) * 3 * 86400000,
  updatedAt: now - (i + 1) * 3 * 86400000,
}));

const backup = { format: 'watchheart-backup', version: 1, exportedAt: new Date(now).toISOString(), entries, watchlist: items };
const out = join(here, 'demo-backup.json');
writeFileSync(out, JSON.stringify(backup, null, 1));
console.log(`${out}: ${entries.length} viewings, ${items.length} on the watchlist, up to ${day(0)}`);
