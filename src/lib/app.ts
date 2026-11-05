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

/** Watch Heart is one of the Heart Apps; the same names and lines as the Heart Apps website. */
export const HEART_APPS = {
  url: 'https://inigo-code.github.io/',
  line: 'Free Android apps by Inigo. No ads, no tracking, nothing to buy.',
  apps: [{ name: 'Prompt Heart', tagline: 'For the AI prompts that work', url: 'https://inigo-code.github.io/prompt-heart-site/' }],
};

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
 * Shown once after an update installs ("What's new in this cut"). Every update gets one, over-the-air
 * ones included: before each eas update or build, give it a new id and lines for that update's changes.
 * An update that leaves it alone shows nothing.
 */
export const WHATS_NEW = {
  id: '1.5.0',
  items: [
    'This week shows dates, like 1st and 2nd, instead of repeated day letters',
    'Resize the widget and it shows more; its buttons respond right away',
    'Air dates and release alerts stay up to date even if you don’t open the app',
    'A show changed on two phones keeps the ticks from both',
    'Unticking an episode now takes it out of the Diary, whichever day it was logged',
    'Hours watched count every episode in a viewing',
    'Episode alerts follow the season you’re on to its end, then wait for the next one',
    'Air dates and alerts use your own time zone when the exact time is known',
    'Added a title before it’s out? Get an alert the day it’s released, on or off in Settings',
  ],
};
