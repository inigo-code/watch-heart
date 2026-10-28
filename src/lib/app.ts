// Branding and developer details shown in the app. Change them here.
export const APP_NAME = 'Watch Heart';
/** For file names and other places spaces don't belong. */
export const APP_SLUG = 'watchheart';
export const APP_TAGLINE = 'Your film, series and anime diary.';

export const DEVELOPER = {
  name: 'Inigo',
  github: 'https://github.com/inigo-code',
};

export const SUPPORT_EMAIL = 'inigo@tosstheworld.org';

/**
 * AniList's terms bar "anime and manga list or tracker services" from its API, so Watch Heart only
 * uses it with written permission from AniList (contact@anilist.co). Until then anime comes from TMDB.
 * Flip this to true once they say yes, and publish an update.
 */
export const ANILIST_ALLOWED = false;

/** Where the free data comes from. TMDB's terms require its logo and the notice below in the app. */
export const DATA_SOURCES = {
  tmdb: {
    label: 'TMDB',
    url: 'https://www.themoviedb.org',
    // The wording TMDB's API Terms of Use ask for.
    notice: 'Watch Heart uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.',
    keyUrl: 'https://www.themoviedb.org/settings/api',
  },
  anilist: { label: 'AniList', url: 'https://anilist.co' },
  tvmaze: { label: 'TVmaze', url: 'https://www.tvmaze.com', notice: 'TV data from TVmaze, licensed CC BY-SA.' },
} as const;

/**
 * Shown once after an update installs ("What's new in this cut"). Change the id and the lines with each
 * update worth telling people about; an update that leaves it alone shows nothing.
 */
export const WHATS_NEW = {
  id: '1.1.0',
  items: [
    'Your photo on the home screen, with a dot that shows your sync',
    'Profile photos picked with the phone’s photo picker, cropped square and sharp',
    'Watched with, Movie buddies and headings that stand out',
  ],
};
