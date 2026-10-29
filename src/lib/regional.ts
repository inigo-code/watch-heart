import type { BrowseQuery } from '@/api/tmdb';
import { countryName } from '@/lib/discover';

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
  return { q: { kind: 'movie', country: region, days: [-42, 3], notGenres: ['Documentary', 'Music'] }, kicker: `NEW FROM ${countryName(region).toUpperCase()}` };
}
