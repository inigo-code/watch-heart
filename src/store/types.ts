export type MediaKind = 'movie' | 'tv' | 'anime';

/** Where a title's details came from. 'manual' means typed in by hand. */
export type Source = 'tmdb' | 'anilist' | 'tvmaze' | 'manual';

/** A title as found in search, before it's logged. */
export type Title = {
  kind: MediaKind;
  source: Source;
  /** The id at the source (empty for manual). */
  sourceId: string;
  title: string;
  /** Original-language title when it differs, e.g. the Japanese romaji for an anime. */
  originalTitle?: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview?: string;
  genres: string[];
  /** Minutes: a film's running time, or one episode's for a series. */
  runtime: number | null;
  /** Episode count, for series and anime. */
  episodes?: number | null;
  /** Director for films, network or studio for series and anime. */
  credit?: string | null;
  /** When TMDB details were fetched, if they came from a saved record (see Entry.fetchedAt). */
  fetchedAt?: number | null;
};

/** One viewing in the diary. */
export type Entry = {
  id: string;
  kind: MediaKind;
  source: Source;
  sourceId: string;
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  runtime: number | null;
  credit: string | null;
  /** Local date watched, YYYY-MM-DD. */
  watchedOn: string;
  /** Half stars: 0 (no rating) to 10 (five stars). */
  rating: number;
  liked: boolean;
  rewatch: boolean;
  /** For series and anime: what you watched, e.g. "Season 2" or "Ep 1–12". */
  progress: string;
  review: string;
  /** The review gives away the plot; it's hidden behind a tap. */
  spoilers: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  /**
   * When the TMDB details (poster, genres, running time, credit) were last fetched. TMDB allows keeping
   * them for 6 months, so older ones are refreshed (src/lib/tmdbFreshness.ts). 0 = removed, refresh when possible.
   */
  fetchedAt?: number | null;
  /** Set when moved to Trash. */
  deletedAt: number | null;
};

export type EntryDraft = Omit<Entry, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** A title you want to watch. Logging it takes it off the list. */
export type WatchItem = {
  id: string;
  kind: MediaKind;
  source: Source;
  sourceId: string;
  title: string;
  originalTitle: string | null;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  runtime: number | null;
  credit: string | null;
  /** Why it's on the list, e.g. "Recommended by Sam". */
  note: string;
  addedAt: number;
  /**
   * When the TMDB details (poster, genres, running time, credit) were last fetched. TMDB allows keeping
   * them for 6 months, so older ones are refreshed (src/lib/tmdbFreshness.ts). 0 = removed, refresh when possible.
   */
  fetchedAt?: number | null;
};
