// IMDb's own rating has no free official API. OMDb (omdbapi.com) serves it with a free personal key
// (1,000 lookups a day), which you paste into Settings; it also has Rotten Tomatoes and Metacritic scores.

/** The key to use: your own from Settings, else one built in at build time (EXPO_PUBLIC_OMDB_KEY), else none. */
export function omdbKey(userKey: string): string {
  return userKey.trim() || (process.env.EXPO_PUBLIC_OMDB_KEY ?? '').trim();
}

export type OmdbRatings = { imdb: { rating: string; votes: string } | null; rottenTomatoes: string | null; metacritic: string | null };

export async function omdbRatings(key: string, imdbId: string, signal?: AbortSignal): Promise<OmdbRatings> {
  const res = await fetch(`https://www.omdbapi.com/?${new URLSearchParams({ i: imdbId, apikey: key })}`, { signal });
  const d = (await res.json()) as {
    Response?: string;
    Error?: string;
    imdbRating?: string;
    imdbVotes?: string;
    Ratings?: { Source: string; Value: string }[];
  };
  if (d.Response === 'False')
    throw new Error(d.Error === 'Invalid API key!' ? 'OMDb didn’t accept your key. Check it in Settings.' : (d.Error ?? 'OMDb had no answer.'));
  const by = (source: string) => d.Ratings?.find((r) => r.Source === source)?.Value ?? null;
  return {
    imdb: d.imdbRating && d.imdbRating !== 'N/A' ? { rating: d.imdbRating, votes: d.imdbVotes ?? '' } : null,
    rottenTomatoes: by('Rotten Tomatoes'),
    metacritic: by('Metacritic'),
  };
}

// Common time zones and their countries. A phone set to English (US) in India still says Asia/Kolkata.
const ZONES: Record<string, string> = {
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Dhaka': 'BD',
  'Asia/Karachi': 'PK',
  'Asia/Colombo': 'LK',
  'Asia/Kathmandu': 'NP',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Qatar': 'QA',
  'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Jakarta': 'ID',
  'Asia/Bangkok': 'TH',
  'Asia/Manila': 'PH',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Hong_Kong': 'HK',
  'Asia/Taipei': 'TW',
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Warsaw': 'PL',
  'Europe/Istanbul': 'TR',
  'Africa/Johannesburg': 'ZA',
  'Africa/Lagos': 'NG',
  'Africa/Nairobi': 'KE',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Mexico_City': 'MX',
  'America/Sao_Paulo': 'BR',
  'America/Argentina/Buenos_Aires': 'AR',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Brisbane': 'AU',
  'Pacific/Auckland': 'NZ',
};

/** Where to watch: your choice in Settings, else the phone's time zone, else its language's region, else India. */
export function watchRegion(setting: string): string {
  if (/^[A-Z]{2}$/.test(setting)) return setting;
  try {
    const zone = ZONES[Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''];
    if (zone) return zone;
  } catch {}
  try {
    // "en-IN", "hi-Latn-IN": the country is the two capital letters.
    const region = Intl.DateTimeFormat()
      .resolvedOptions()
      .locale.match(/[-_]([A-Z]{2})(?:[-_]|$)/)?.[1];
    if (region) return region;
  } catch {}
  return 'IN';
}
