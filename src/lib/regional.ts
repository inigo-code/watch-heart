import type { BrowseQuery } from '@/api/tmdb';
import { inCountry } from '@/lib/discover';

export type Language = { code: string; name: string };

/** India's film languages, the biggest industries first. */
export const INDIAN_LANGUAGES: Language[] = [
  { code: 'ml', name: 'Malayalam' },
  { code: 'ta', name: 'Tamil' },
  { code: 'hi', name: 'Hindi' },
  { code: 'te', name: 'Telugu' },
  { code: 'kn', name: 'Kannada' },
  { code: 'bn', name: 'Bengali' },
];

// A country's own film languages, to tell its films from dubbed foreign ones (India: every language with a
// film industry, not only the ones you can pick).
const OWN_FILM_LANGUAGES: Record<string, string[]> = { IN: [...INDIAN_LANGUAGES.map((l) => l.code), 'mr', 'pa', 'gu', 'or', 'as'] };
const DAY = 86_400_000;

/**
 * Whether a film that opened in cinemas in `region` on `opened` is likely still showing on `today` (both
 * YYYY-MM-DD). TMDB has no showtimes, so this goes by how long films run: the country's own films up to five
 * weeks, others three (a dubbed Korean hit leaves Indian cinemas well before a local one). Countries without a
 * list of their own languages keep five weeks for every film.
 */
export function stillInCinemas(region: string, lang: string | undefined, opened: string | undefined, today: string): boolean {
  if (!opened) return false;
  const days = Math.round((Date.parse(today) - Date.parse(opened.slice(0, 10))) / DAY);
  const own = OWN_FILM_LANGUAGES[region];
  const weeks = !own || (lang && own.includes(lang)) ? 5 : 3;
  return days >= 0 && days <= weeks * 7;
}

/** The languages you can pick for a country's films (only India has several). */
export const languagesFor = (region: string) => (region === 'IN' ? INDIAN_LANGUAGES : []);

/** Your language from Settings, when it belongs to the region. */
export const homeLanguage = (region: string, setting: string) => languagesFor(region).find((l) => l.code === setting) ?? null;

/**
 * The first cards in Home's slider: new films in your language, or from your country, before the world's
 * top titles. None for the US, whose films already lead Trending.
 */
export function regionalFeatured(region: string, lang: Language | null): { q: BrowseQuery; kicker: string } | null {
  if (lang) return { q: { kind: 'movie', country: region, lang: lang.code, days: [-42, 3], notGenres: ['Documentary', 'Music'] }, kicker: `NEW IN ${lang.name.toUpperCase()}` };
  if (region === 'US') return null;
  return { q: { kind: 'movie', country: region, days: [-42, 3], notGenres: ['Documentary', 'Music'] }, kicker: `NEW FROM ${inCountry(region).toUpperCase()}` };
}
