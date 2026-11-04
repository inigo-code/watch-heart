// TMDB says which services carry a title, but gives no link into them (only its own page). So a tap opens
// the service's search for the title: Android hands these to the service's app when it's installed and the
// app claims the link, otherwise they open on its site. Each address here was checked by hand.
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
