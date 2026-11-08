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
 * ones included: before each eas update or build, add a new note at the top with a new id and lines for
 * that update's changes. A phone shows only the notes newer than the last one it saw, so the list never
 * piles up. An update that adds no note shows nothing.
 */
const NOTES: { id: string; items: string[] }[] = [
  {
    id: '1.5.7',
    items: [
      'Award winners in Discover: Best Picture, Palme d’Or, Golden Lion, Golden Bear, Best International Feature, Best Animated Feature and India’s National Film Award, newest first',
    ],
  },
  {
    id: '1.5.6',
    items: [
      'Text size in Settings, under Look: Small, Default, Large or Larger. Stories stay the same.',
      'Memory stories have filters for your photo: Warm, Cool, Faded, Vintage, Dusk and Spotlight',
      'One Story card button on an entry: choose Review or Memory inside it',
      'More lists in Discover: A24, Studio Ghibli, Pixar, Korean cinema, Malayalam favourites, neo-noir, cyberpunk, whodunits and more',
    ],
  },
  {
    id: '1.5.5',
    items: [
      'Memory stories: write your own top line and a line under the title',
      'Move the little poster to any corner of your photo, or hide it, so it never covers a face',
      'A memory from the cinema says At the cinema, whatever time you went',
      'A friend’s Reviews keeps looking until it finds more, then says when they’re all loaded',
    ],
  },
  {
    id: '1.5.4',
    items: [
      'Memory stories: put your own photo from the night in a film frame, with who you went with, and share it',
      'People you might know, under Friends: friends of your friends, and people who watch the same things if you both turn it on',
      'Where to watch has a link to the exact page on each service, and Netflix opens its own search',
      'The logo and WATCH HEART sit on one line on every story',
      'What’s new shows only what’s new since your last update, and its button always stays on screen',
      'A friend’s diary stops offering Load more once everything is there',
      'The Watch Heart mark always fits on a review story, however long the title or review',
      'Settings rows keep their full names instead of cutting them off',
      'With a large phone font, pages keep their shape',
      'Imports use the right date when a file has more than one, and Trakt collections and lists no longer land in your diary',
    ],
  },
  { id: '1.5.3', items: ['The search box on Find now suggests titles from your own watchlist'] },
  { id: '1.5.2', items: ['The A Heart App label in About sits properly in the middle'] },
  {
    id: '1.5.1',
    items: [
      'Friends is now a row of faces, with Add first and See all for the full list',
      'Look at someone’s profile before you add them, if they choose to show it',
      'Block anyone, and unfriending now stays that way',
      'A badge and an alert when someone asks to be your friend',
    ],
  },
  {
    id: '1.5.0',
    items: [
      'With App lock on, the widget hides your titles. To keep them showing, turn on Show titles in the widget in Settings.',
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
  },
];

/** 1.5.10 after 1.5.9: compares version ids part by part, as numbers. */
function newer(a: string, b: string) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
}

export const WHATS_NEW = {
  id: NOTES[0].id,
  /** The lines a phone hasn't seen yet: only this update's, unless it skipped some. */
  since(seen: string | null) {
    const fresh = seen ? NOTES.filter((n) => newer(n.id, seen)) : NOTES.slice(0, 1);
    return (fresh.length ? fresh : NOTES.slice(0, 1)).flatMap((n) => n.items);
  },
};
export const SITE_URL = 'https://inigo-code.github.io/watch-heart-site/';
