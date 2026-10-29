import type { BrowseQuery } from '@/api/tmdb';
import type { MediaKind } from '@/store/types';

// Ready-made ways into Discover. Each is just a TMDB Discover query; nothing here is curated by hand.

export type Shelf = { id: string; name: string; note: string; q: BrowseQuery };

const NOW = new Date().getFullYear();

/** The ready-made shelves. Each opens on the kind it suits; the results can switch to another. */
export const SHELVES: Shelf[] = [
  { id: 'new', name: 'New this month', note: 'Released in the last six weeks', q: { kind: 'movie', days: [-45, 0], notGenres: ['Documentary', 'Music'] } },
  { id: 'airing', name: 'Anime airing now', note: 'Episodes out this fortnight', q: { kind: 'anime', airing: true } },
  { id: 'crowd', name: 'Crowd favourites', note: 'The best rated, by thousands of votes', q: { kind: 'movie', sort: 'rating', minVotes: 3000 } },
  {
    id: 'gems',
    name: 'Hidden gems',
    note: 'Rated highly, seen by few',
    q: { kind: 'movie', sort: 'rating', minScore: 7.2, minVotes: 300, maxVotes: 2500, to: NOW - 1, notGenres: ['Documentary', 'Music'] },
  },
  { id: 'ended', name: 'Ended and complete', note: 'Finished series, no cliffhanger left', q: { kind: 'tv', status: 3, sort: 'rating', minVotes: 300 } },
  { id: 'mini', name: 'Miniseries to binge', note: 'One season, start to finish', q: { kind: 'tv', tvType: 2, sort: 'rating', minVotes: 100 } },
  { id: 'short', name: 'Short and sweet', note: 'Films under 95 minutes, well liked', q: { kind: 'movie', maxRuntime: 95, minScore: 7, minVotes: 500 } },
  { id: 'classics', name: 'Classics', note: 'Before 1980, still loved', q: { kind: 'movie', to: 1979, sort: 'rating', minVotes: 1000 } },
  { id: 'year', name: `Best of ${NOW}`, note: 'This year’s best rated so far', q: { kind: 'movie', from: NOW, to: NOW, sort: 'rating', minVotes: 200 } },
];

/** Which kinds a query makes sense for: series-only filters rule out films, a film length rules out series. */
export function kindsFor(q: BrowseQuery): MediaKind[] {
  if (q.status !== undefined || q.tvType !== undefined || q.airing) return ['tv', 'anime'];
  // An occasion's titles (Christmas, Diwali at home) are films or series; anime would match almost none.
  if (q.keywords?.length || q.country === 'IN') return ['movie', 'tv'];
  if (q.maxRuntime) return ['movie'];
  return ['movie', 'tv', 'anime'];
}

export type Seasonal = Shelf & { icon: 'moon' | 'heart' | 'snow' | 'gift' | 'sparkles' | 'sunny' | 'rainy' | 'people' };

// Diwali follows the lunar calendar; its dates to 2030.
const DIWALI: Record<number, string> = { 2026: '2026-11-08', 2027: '2027-10-29', 2028: '2028-10-17', 2029: '2029-11-05', 2030: '2030-10-26' };

const DAY = 86400000;
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
const daysUntil = (from: Date, to: number) => Math.ceil((to - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / DAY);
const until = (n: number, what: string) => `${n} ${n === 1 ? 'day' : 'days'} until ${what}`;

/**
 * Collections for the time of year (none in a quiet stretch): New Year, winter, Valentine's, summer holidays,
 * the monsoon, Friendship Day, Halloween, Diwali and Christmas. Most follow TMDB's keywords for the occasion.
 */
export function seasonalShelves(today = new Date()): Seasonal[] {
  const y = today.getFullYear();
  const t = new Date(y, today.getMonth(), today.getDate()).getTime();
  const within = (from: number, to: number) => t >= from && t <= to;
  const out: Seasonal[] = [];
  const diwali = DIWALI[y] ? new Date(DIWALI[y] + 'T00:00:00').getTime() : null;
  if (diwali && within(diwali - 12 * DAY, diwali + 2 * DAY)) {
    const n = daysUntil(today, diwali);
    out.push({
      id: 'diwali',
      icon: 'sparkles',
      name: 'Diwali at home',
      note: n > 0 ? `Indian family favourites · ${until(n, 'Diwali')}` : 'Indian family favourites',
      q: { kind: 'movie', country: 'IN', genres: ['Family'], minScore: 7, minVotes: 50 },
    });
  }
  if (within(at(y, 10, 1), at(y, 10, 31))) {
    const n = daysUntil(today, at(y, 10, 31));
    out.push({
      id: 'halloween',
      icon: 'moon',
      name: 'Halloween',
      note: n ? `Films for the night · ${until(n, 'Halloween')}` : 'Films for the night · it’s Halloween',
      q: { kind: 'movie', keywords: [3335], minScore: 6.3, minVotes: 300 },
    });
  }
  if (within(at(y, 12, 1), at(y, 12, 26))) {
    const n = daysUntil(today, at(y, 12, 25));
    out.push({
      id: 'christmas',
      icon: 'gift',
      name: 'Christmas',
      note: n > 0 ? `Festive favourites · ${until(n, 'Christmas')}` : 'Festive favourites',
      q: { kind: 'movie', keywords: [207317], notGenres: ['Horror'], minScore: 6.5, minVotes: 300 },
    });
  }
  if (within(at(y, 12, 27), at(y, 12, 31)) || within(at(y, 1, 1), at(y, 1, 5))) {
    out.push({ id: 'newyear', icon: 'sparkles', name: 'New Year’s Eve', note: 'Films that count down to midnight', q: { kind: 'movie', keywords: [613, 252123], minScore: 6.3, minVotes: 200 } });
  }
  if (within(at(y, 1, 6), at(y, 1, 31))) {
    out.push({ id: 'winter', icon: 'snow', name: 'Snowed in', note: 'Winter films for a cold night', q: { kind: 'movie', keywords: [10794, 1442], minScore: 6.8, minVotes: 500 } });
  }
  if (within(at(y, 2, 1), at(y, 2, 14))) {
    const n = daysUntil(today, at(y, 2, 14));
    out.push({
      id: 'valentine',
      icon: 'heart',
      name: 'Valentine’s romance',
      note: n ? `Well-loved love stories · ${until(n, 'Valentine’s Day')}` : 'Well-loved love stories · it’s Valentine’s Day',
      q: { kind: 'movie', genres: ['Romance'], minScore: 7, minVotes: 1000 },
    });
  }
  if (within(at(y, 4, 15), at(y, 6, 15))) {
    out.push({ id: 'summer', icon: 'sunny', name: 'Summer holidays', note: 'Long days, road trips and first loves', q: { kind: 'movie', keywords: [13088, 14714, 200129], minScore: 6.8, minVotes: 300 } });
  }
  if (within(at(y, 8, 1), at(y, 8, 7))) {
    out.push({ id: 'friendship', icon: 'people', name: 'Friendship Day', note: 'Watch one with your best friend', q: { kind: 'movie', keywords: [6054], minScore: 7.3, minVotes: 1000 } });
  }
  if (within(at(y, 7, 1), at(y, 8, 31))) {
    out.push({ id: 'monsoon', icon: 'rainy', name: 'Rainy-day films', note: 'For the monsoon: rain on screen and outside', q: { kind: 'movie', keywords: [2217, 2385], minScore: 6.8, minVotes: 300 } });
  }
  return out;
}

export const DECADES = Array.from({ length: 11 }, (_, i) => 2020 - i * 10);

/** Original languages, by name; Indian languages are many people's first search. */
export const LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'kn', name: 'Kannada' },
  { code: 'bn', name: 'Bengali' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Mandarin' },
  { code: 'cn', name: 'Cantonese' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'de', name: 'German' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'fa', name: 'Persian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'th', name: 'Thai' },
  { code: 'id', name: 'Indonesian' },
];

export const COUNTRIES = ['US', 'GB', 'IN', 'JP', 'KR', 'FR', 'IT', 'ES', 'DE', 'CA', 'AU', 'IE', 'CN', 'HK', 'TW', 'BR', 'MX', 'AR', 'SE', 'DK', 'NO', 'NL', 'BE', 'PL', 'TR', 'IR', 'NZ'];

/** A country's flag, from its two-letter code. */
export const flag = (code: string) => String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

const REGION_NAMES = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
/** "Japan" for JP, falling back to the code where the phone can't name it. */
export const countryName = (code: string) => {
  try {
    return REGION_NAMES?.of(code) ?? code;
  } catch {
    return code;
  }
};
