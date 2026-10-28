// IMDb's own rating has no free official API. OMDb (omdbapi.com) serves it with a free personal key
// (1,000 lookups a day), which you paste into Settings; it also has Rotten Tomatoes and Metacritic scores.

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
  if (d.Response === 'False') throw new Error(d.Error === 'Invalid API key!' ? 'OMDb didn’t accept your key. Check it in Settings.' : (d.Error ?? 'OMDb had no answer.'));
  const by = (source: string) => d.Ratings?.find((r) => r.Source === source)?.Value ?? null;
  return {
    imdb: d.imdbRating && d.imdbRating !== 'N/A' ? { rating: d.imdbRating, votes: d.imdbVotes ?? '' } : null,
    rottenTomatoes: by('Rotten Tomatoes'),
    metacritic: by('Metacritic'),
  };
}

/** Where to watch: your choice in Settings, else the phone's region, else India. */
export function watchRegion(setting: string): string {
  if (/^[A-Z]{2}$/.test(setting)) return setting;
  try {
    // "en-IN", "hi-Latn-IN": the country is the two capital letters.
    const region = Intl.DateTimeFormat().resolvedOptions().locale.match(/[-_]([A-Z]{2})(?:[-_]|$)/)?.[1];
    if (region) return region;
  } catch {}
  return 'IN';
}
