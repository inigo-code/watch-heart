import { halfStars, importedEntry, importedWatch, toDay, yearOf } from './common';
import type { ImportResult } from './common';

// MyAnimeList list export (myanimelist.net → Profile → Export → Anime List; a .xml.gz, picked as it is).
// AniList users can export the same format with a MAL-XML exporter. One <anime> block per title:
// - Completed, Watching, On-Hold, Dropped → diary entries (dated by finish or start date; undated
//   ones go to the Archive)
// - Plan to Watch → Watchlist

/** True when an XML file is a MyAnimeList anime list. */
export const isMalXml = (xml: string) => /<myanimelist>/i.test(xml) && /<anime>/i.test(xml);

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  return m[1]
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .trim();
}

export function fromMal(xml: string): ImportResult {
  const result: ImportResult = { entries: [], watchlist: [] };
  for (const [block] of xml.matchAll(/<anime>[\s\S]*?<\/anime>/gi)) {
    const id = tag(block, 'series_animedb_id');
    const title = tag(block, 'series_title');
    if (!title) continue;
    const status = tag(block, 'my_status').toLowerCase();
    const total = Number(tag(block, 'series_episodes')) || 0;
    const seen = Number(tag(block, 'my_watched_episodes')) || 0;
    const isFilm = /movie/i.test(tag(block, 'series_type'));
    if (status.startsWith('plan') || status === '6') {
      result.watchlist.push(importedWatch(`malw-${id || title}`, { kind: 'anime', title }));
      continue;
    }
    const finished = toDay(tag(block, 'my_finish_date'));
    const started = toDay(tag(block, 'my_start_date'));
    const label = /hold|^3$/.test(status) ? 'on hold' : /drop|^4$/.test(status) ? 'dropped' : /watching|^1$/.test(status) ? 'watching' : '';
    const progress = isFilm ? '' : total ? `Ep ${seen}/${total}${label ? ` · ${label}` : ''}` : seen ? `${seen} eps${label ? ` · ${label}` : ''}` : label;
    result.entries.push(
      importedEntry(`mal-${id || title}`, {
        kind: 'anime',
        title,
        year: yearOf(tag(block, 'series_start')) ?? null,
        watchedOn: finished ?? started,
        rating: halfStars(tag(block, 'my_score'), 10),
        rewatch: Number(tag(block, 'my_times_watched')) > 0 || tag(block, 'my_rewatching') === '1',
        progress,
        review: tag(block, 'my_comments'),
        tags: tag(block, 'my_tags').split(',').map((t) => t.trim()).filter(Boolean),
      }),
    );
  }
  return result;
}
