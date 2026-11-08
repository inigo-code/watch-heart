import * as Linking from 'expo-linking';

import { AppLauncher } from '../../modules/app-launcher';

// TMDB says which services carry a title, but gives no link into them (only its own where-to-watch page).
// So a tap opens the service's search for the title: Android hands these to the service's app when it's
// installed and the app claims the link, otherwise they open on its site. Each address here was checked by
// hand. Netflix's search needs signing in on the web, but its app takes the link.
const SEARCHES: [RegExp, (title: string) => string][] = [
  [/netflix/i, (t) => `https://www.netflix.com/search?q=${t}`],
  [/prime video|amazon video/i, (t) => `https://www.primevideo.com/search?phrase=${t}`],
  [/hotstar|disney/i, (t) => `https://www.hotstar.com/in/explore?search_query=${t}`],
  [/zee ?5/i, (t) => `https://www.zee5.com/search?q=${t}`],
  [/apple tv/i, (t) => `https://tv.apple.com/search?term=${t}`],
  [/youtube/i, (t) => `https://www.youtube.com/results?search_query=${t}`],
  [/google play/i, (t) => `https://play.google.com/store/search?q=${t}&c=movies`],
  [/sun ?nxt/i, (t) => `https://www.sunnxt.com/search?q=${t}`],
  [/^aha/i, (t) => `https://www.aha.video/search?q=${t}`],
  [/hoichoi/i, (t) => `https://www.hoichoi.tv/search?q=${t}`],
  [/crunchyroll/i, (t) => `https://www.crunchyroll.com/search?q=${t}`],
  [/mubi/i, (t) => `https://mubi.com/en/search/films?query=${t}`],
  [/eros ?now/i, (t) => `https://erosnow.com/search?q=${t}`],
  [/manorama/i, (t) => `https://www.manoramamax.com/search?q=${t}`],
];

/** Where a tap on a service goes: its search for the title, or a web search for the two together. */
export function watchLink(service: string, title: string) {
  const search = SEARCHES.find(([name]) => name.test(service));
  if (search) return search[1](encodeURIComponent(title));
  return `https://www.google.com/search?q=${encodeURIComponent(`${title} on ${service}`)}`;
}

// Each service's Android app. Keep in sync with plugins/withStreamingQueries.js.
const APPS: [RegExp, string][] = [
  [/netflix/i, 'com.netflix.mediaclient'],
  [/prime video|amazon video/i, 'com.amazon.avod.thirdpartyclient'],
  [/hotstar|disney/i, 'in.startv.hotstar'],
  [/zee ?5/i, 'com.graymatrix.did'],
  [/sony ?liv/i, 'com.sonyliv'],
  [/apple tv/i, 'com.apple.atve.androidtv.appletv'],
  [/youtube/i, 'com.google.android.youtube'],
  [/sun ?nxt/i, 'com.suntv.sunnxt'],
  [/^aha/i, 'ahaflix.tv'],
  [/hoichoi/i, 'com.viewlift.hoichoi'],
  [/crunchyroll/i, 'com.crunchyroll.crunchyroid'],
  [/mubi/i, 'com.mubi'],
  [/eros ?now/i, 'com.erosnow'],
  [/manorama/i, 'com.mmtv.manoramamax.android'],
  [/mx ?player/i, 'com.mxtech.videoplayer.ad'],
];

/**
 * Opens a service for a title, keeping to every service's terms (no scraping, no unofficial APIs):
 * 1. The service's own search for the title, inside its app when the app takes that link.
 * 2. Otherwise TMDB's where-to-watch page for the title (the link TMDB's API gives for this), whose
 *    JustWatch buttons open the exact title in each service's app.
 * 3. Without either, the service's website search, or a web search for the two together.
 */
export async function openOnService(service: string, title: string, watchPage?: string | null) {
  const search = SEARCHES.find(([name]) => name.test(service));
  const link = search?.[1](encodeURIComponent(title));
  const app = APPS.find(([name]) => name.test(service))?.[1];
  if (link && app && AppLauncher?.isInstalled(app) && AppLauncher.openLink(link, app)) return;
  if (watchPage) return Linking.openURL(watchPage);
  await Linking.openURL(link ?? watchLink(service, title));
}
