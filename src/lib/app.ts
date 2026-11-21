import Constants from 'expo-constants';

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
 * piles up. An update that adds no note shows nothing. A line about something native (it needs that build)
 * names the build with `fromApp`, so phones still on an older build, which get the same update over the
 * air, don't read about it.
 */
type Note = string | { text: string; fromApp: string };
const NOTES: { id: string; items: Note[] }[] = [
  {
    id: '1.7.5',
    items: ['In cinemas is closer to what’s really showing: in India, films that aren’t in an Indian language now leave it after three weeks'],
  },
  {
    id: '1.7.4',
    // Only the 1.7.3 build ever had Book tickets.
    items: [{ text: 'Book tickets has been taken off film pages', fromApp: '1.7.3' }],
  },
  {
    id: '1.7.3',
    items: [
      'Trending this week on Home, in place of Up next: what everyone is watching right now. Your watchlist is still in its own tab',
      { text: 'Your diary no longer comes back by itself when the app is reinstalled. Sign in to keep it safe, or use Export backup', fromApp: '1.7.3' },
    ],
  },
  {
    id: '1.7.2',
    items: ['Fixed: the black flash that could still appear when opening the app'],
  },
  {
    id: '1.7.1',
    items: [
      'Opening the app no longer flashes a black screen between the logo and its animation',
      'Country names are written out in full on phones: “In cinemas in India” instead of “IN”',
    ],
  },
  {
    id: '1.7.0',
    items: [
      'When you log something new, its ticket prints and a LOGGED stamp comes down on it',
      'Recap has the reel: everything you watched that month as a strip of film, in order, with your busiest day lit. Tap a frame to open it',
      'Empty pages are drawn as a blank ticket or an empty strip of film, with one button for what to do next',
      'The Up next widget shows each title as a ticket, in the app’s own type',
      'Buttons and chips grow with larger text instead of cutting it off',
      'The Watchlist’s pick is centred properly',
      'A title’s page opens in one piece: its name, year and director no longer jump in a moment later',
      'Cleaner labels: no more dots between words, counts sit beside their names in lighter type',
      'Set-up has a back arrow, and so do the log form and the poster and share pages',
      'Discover’s Films, Series and Anime switch matches the rest of the app',
      'Small fixes to wording and spacing across the app',
      'With the new version from Google Play or F-Droid, the opening screen fills the whole screen on Android 15',
    ],
  },
  {
    id: '1.6.9',
    items: [
      'New icons drawn for Watch Heart: a cinema for Home, a ticket for the Diary, a lens for Find, a bookmark for the Watchlist, a reel for Recap and a clapperboard for logging',
      'This week on Home is a strip of film, with today’s frame lit',
      'A planned movie night is a ticket, with the day and time on its stub',
      'Posters have a fine edge, so pale ones stand out from the page',
      'A light tap under your finger when you tick an episode, +1 or move the stars (turn it off in Settings › Haptics)',
    ],
  },
  {
    id: '1.6.8',
    items: [
      'Episodes: a season’s episodes are one tidy list, with Mark season seen and Rate season side by side',
      'Rows of posters run to the edge of the screen, so it’s clear they scroll',
      'On a title or an entry, the top bar fills in as you scroll, so text no longer runs under the back button',
      'Pages without a picture at the top have a plain back arrow',
      'Scores sit in matching boxes, and the one that opens IMDb shows it',
      'Settings: plainer icons, and your account, profile and friends in one group. Your own OMDb key is hidden like the TMDB one',
      'Log it stays grey until there’s a title, and gold is kept for the main button on each page',
      'The Trending and Discover switch on Find fits properly',
    ],
  },
  {
    id: '1.6.7',
    items: [
      'A new look: clearer type throughout, calmer colours, and gold kept for the main buttons',
      'Headings, buttons and tabs read in normal letters instead of capitals, and Home’s header is smaller',
      'A calmer Home: your week, what you’re watching, friends and your watchlist first, then For you, In cinemas and New Indian releases',
      'In cinemas shows only films playing in cinemas in your country now, with See all',
      'New Indian releases has a chip for each language',
      'Indian favourites by language are now lists in Discover',
      'New this week and Trending this week left Home; Trending is still in Find',
    ],
  },
  {
    id: '1.6.6',
    items: ['With no internet, Find and the rest of the app say “No connection”, and other problems are explained in plain words instead of technical errors'],
  },
  {
    id: '1.6.5',
    items: [
      'Friends lately shows up straight away when you open the app, with what it showed last time, and updates as soon as the new one is in. With App lock on, it isn’t kept on the phone.',
    ],
  },
  {
    id: '1.6.4',
    items: ['The Recap story shows each show once, however many episodes you logged that month, and counts it as one title'],
  },
  {
    id: '1.6.3',
    items: [
      'This week on Home shows the day of the week (MON, TUE…) instead of the date',
      'Friends lately keeps its place on Home while it loads, so Up next no longer jumps down when you open the app or pull to refresh',
      'An entry with no watch date shows “DATE ?” on its ticket, as it does in the Diary, not the day you logged it',
      'Where to watch and On your services name your country in full',
      'The Episodes page asks “Watched on” the same way the log form does',
      'Recap explains why entries without a watch date aren’t in a month',
      'Settings: short hints like “Needs an account” are no longer cut off',
    ],
  },
  {
    id: '1.6.2',
    items: [
      'Hold an episode to pick the day you watched it, or move it to another day. Its sheet shows the day you saw it, with Change the day',
      'Hold a season (its chip or Mark season as seen) to log the whole season on one day, or unmark it',
      'The ⋯ menu on the Episodes page can mark every aired episode as seen, change the day for every episode you’ve seen, or unmark them all',
      'Hold +1 in Up next or Continue watching to log the next episode on another day',
      'Hold Log it on a title’s page, or choose “Watched it: just pick the day” on the Watchlist, to log it on a day without the form',
      'Diary: hold an entry and choose Change the date. Its episodes move with it',
    ],
  },
  {
    id: '1.6.1',
    items: [
      'Episodes can be logged on any day: the Episodes page has Today, Yesterday, Pick a date and Don’t remember, and ticks, Mark season as seen and Up next use the day you choose',
      'Logging a season of a show from the log form ticks off that season’s episodes, so Season 1 no longer shows as unwatched when you go on to Season 2',
      'Changing the date of a viewing (or setting it to Don’t remember) moves its episodes to that day, so Continue watching no longer says you saw them today',
      'Log again on a series starts fresh: no episodes or stars copied from the last viewing, and it isn’t marked as a rewatch',
    ],
  },
  {
    id: '1.5.8',
    items: [
      'Watchlist has a new sort, Shortest first, with each title’s running time (per episode for series and anime)',
      'Diary search also finds words in your reviews and a title’s year',
      'Home says when you seem to be offline, and leaves out rows that can’t load instead of showing grey shapes. Your diary and watchlist still work.',
      'An episode you untick stays unticked when your other phone syncs',
      'If your diary ever can’t be opened, Watch Heart says so and lets you try again, instead of showing it empty. Your lists and settings are kept safe the same way.',
      'With App lock off, the lock screen no longer flashes as the app opens',
    ],
  },
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
    const native = Constants.nativeAppVersion ?? '0';
    return (fresh.length ? fresh : NOTES.slice(0, 1))
      .flatMap((n) => n.items)
      .filter((item) => typeof item === 'string' || native.localeCompare(item.fromApp, undefined, { numeric: true }) >= 0)
      .map((item) => (typeof item === 'string' ? item : item.text));
  },
};
export const SITE_URL = 'https://inigo-code.github.io/watch-heart-site/';
