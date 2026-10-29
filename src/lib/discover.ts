import type { BrowseQuery } from '@/api/tmdb';
import type { MediaKind } from '@/store/types';

// Ready-made ways into Discover. Each is just a TMDB Discover query; nothing here is curated by hand.

export type Shelf = { id: string; name: string; note: string; q: BrowseQuery };

const NOW = new Date().getFullYear();

/** The ready-made shelves. Each opens on the kind it suits; the results can switch to another. */
export const SHELVES: Shelf[] = [
  { id: 'new', name: 'New this month', note: 'Released in the last six weeks', q: { kind: 'movie', days: [-45, 0] } },
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
  if (q.maxRuntime) return ['movie'];
  return ['movie', 'tv', 'anime'];
}

/** A shelf for the time of year, when there is one: horror in October, romance in February, family films in December. */
export function seasonalShelf(today = new Date()): Shelf | null {
  const m = today.getMonth();
  if (m === 9) {
    const days = Math.max(0, Math.ceil((new Date(today.getFullYear(), 9, 31).getTime() - today.getTime()) / 86400000));
    return {
      id: 'halloween',
      name: 'Halloween horror',
      note: days ? `Well-loved horror · ${days} ${days === 1 ? 'day' : 'days'} until Halloween` : 'Well-loved horror · it’s Halloween',
      q: { kind: 'movie', genres: ['Horror'], minScore: 6.8, minVotes: 1500 },
    };
  }
  if (m === 1) return { id: 'valentine', name: 'Valentine’s romance', note: 'Well-loved love stories', q: { kind: 'movie', genres: ['Romance'], minScore: 7, minVotes: 1000 } };
  if (m === 11) return { id: 'cosy', name: 'Cosy December', note: 'Family films for the holidays', q: { kind: 'movie', genres: ['Family'], minScore: 6.8, minVotes: 1000 } };
  return null;
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
