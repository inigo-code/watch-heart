import { column, hash, importedEntry, records, slashOrder, toDay } from './common';
import type { ImportResult, Row } from './common';

// Netflix viewing history, in either form:
// - netflix.com → Account → Profile → Viewing activity → Download all: NetflixViewingHistory.csv (Title, Date)
// - Account → Download your personal information: CONTENT_INTERACTION/ViewingActivity.csv (Profile Name,
//   Start Time, Duration, Title, Supplemental Video Type…), for every profile. Trailers and previews are
//   left out, and so are plays under five minutes.
// Netflix titles name the episode too ("Severance: Season 2: Hello, Ms. Cobel"): episodes of a show
// watched on the same day become one entry, like "Season 2 · 3 episodes".

export function isNetflix(headers: string[]): boolean {
  const h = headers.map((x) => x.toLowerCase());
  return (h.length === 2 && h[0] === 'title' && h[1] === 'date') || (h.includes('start time') && h.includes('title') && h.includes('supplemental video type'));
}

// Words that mark the season part of a Netflix title.
const SEASON = /^(season|series|part|volume|vol\.|chapter|book|collection|limited series|miniseries|temporada|saison|staffel)\b/i;

// Numbered seasons are unambiguous even as the last part ("Show: Season 2").
const NUMBERED_SEASON = /^(season|series|temporada|saison|staffel) \d+/i;

/**
 * "Show: Season 2: Episode" → show and season; a plain title is a film. A word like "Part" only marks a
 * season when an episode name follows it, so "Dune: Part Two" stays a film.
 */
export function splitNetflixTitle(title: string): { show: string; season: string | null; film: boolean } {
  const parts = title.split(': ');
  const at = parts.findIndex((p, i) => i > 0 && SEASON.test(p) && (i < parts.length - 1 || NUMBERED_SEASON.test(p)));
  if (at > 0) return { show: parts.slice(0, at).join(': '), season: parts[at], film: false };
  if (parts.length >= 3) return { show: parts[0], season: null, film: false };
  if (/: Episode \d+$/i.test(title)) return { show: parts[0], season: null, film: false };
  return { show: title, season: null, film: true };
}

const minutes = (d: string) => {
  const [h, m, s] = d.split(':').map(Number);
  return (h || 0) * 60 + (m || 0) + (s || 0) / 60;
};

export function fromNetflix(csv: string): ImportResult & { profile?: string; skippedProfiles?: string[] } {
  const { headers, rows: all } = records(csv);
  const titleCol = column(headers, ['title']) ?? 'Title';
  const dateCol = column(headers, ['starttime', 'date']) ?? 'Date';
  let rows: Row[] = all;
  let profile: string | undefined;
  let skippedProfiles: string[] | undefined;

  const profileCol = column(headers, ['profilename']);
  if (profileCol) {
    // The full export covers every profile on the account: keep the one that watched the most.
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r[profileCol], (counts.get(r[profileCol]) ?? 0) + 1);
    profile = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    skippedProfiles = [...counts.keys()].filter((p) => p !== profile);
    const extraCol = column(headers, ['supplementalvideotype']);
    const durationCol = column(headers, ['duration']);
    rows = rows.filter((r) => r[profileCol] === profile && !(extraCol && r[extraCol]) && !(durationCol && minutes(r[durationCol]) < 5));
  }

  const order = slashOrder(rows.map((r) => r[dateCol]));
  const groups = new Map<string, { show: string; seasons: Set<string>; count: number; film: boolean; day: string }>();
  for (const r of rows) {
    const day = toDay(r[dateCol], order);
    const title = r[titleCol];
    if (!day || !title) continue;
    const { show, season, film } = splitNetflixTitle(title);
    const k = `${show}|${day}`;
    const g = groups.get(k) ?? { show, seasons: new Set<string>(), count: 0, film, day };
    if (season) g.seasons.add(season);
    g.count++;
    groups.set(k, g);
  }

  const entries = [...groups.entries()].map(([k, g]) =>
    importedEntry(`nf-${hash(k)}`, {
      kind: g.film ? 'movie' : 'tv',
      title: g.show,
      watchedOn: g.day,
      progress: g.film ? '' : `${g.seasons.size === 1 ? `${[...g.seasons][0]} · ` : ''}${g.count} ${g.count === 1 ? 'episode' : 'episodes'}`,
    }),
  );
  return { entries, watchlist: [], profile, skippedProfiles };
}
