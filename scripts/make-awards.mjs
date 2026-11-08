// Builds src/lib/awards.ts: award winners as TMDB ids, newest first, from Wikidata (CC0, free to reuse).
// Run it after each award season: node scripts/make-awards.mjs
// Only the TMDB ids and years are kept; titles and posters come from TMDB in the app, as for everything else.
import { writeFileSync } from 'node:fs';

const UA = 'WatchHeart-list-builder/1.0 (https://github.com/inigo-code/watch-heart)';

const AWARDS = [
  { id: 'oscar-picture', qid: 'Q102427', name: 'Best Picture winners', note: 'Every Oscar for Best Picture' },
  { id: 'palme', qid: 'Q179808', name: 'Palme d’Or', note: 'Cannes’ top prize, year by year' },
  { id: 'golden-lion', qid: 'Q209459', name: 'Golden Lion', note: 'Venice’s best film each year' },
  { id: 'golden-bear', qid: 'Q154590', name: 'Golden Bear', note: 'Berlin’s best film each year' },
  { id: 'oscar-international', qid: 'Q105304', name: 'Best International Feature', note: 'The Oscar for a film from abroad' },
  { id: 'oscar-animated', qid: 'Q106800', name: 'Best Animated Feature', note: 'Every Oscar winner since 2002' },
  { id: 'national', qid: 'Q1435633', name: 'National Film Award', note: 'India’s Best Feature Film' },
];

async function sparql(query) {
  const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  return (await res.json()).results.bindings;
}

const lists = [];
for (const a of AWARDS) {
  const rows = await sparql(`SELECT ?tmdb (MIN(YEAR(?t)) AS ?won) (MIN(YEAR(?pub)) AS ?made) WHERE {
    ?f p:P166 ?st . ?st ps:P166 wd:${a.qid} . OPTIONAL { ?st pq:P585 ?t }
    ?f wdt:P4947 ?tmdb . OPTIONAL { ?f wdt:P577 ?pub }
  } GROUP BY ?tmdb`);
  const films = rows
    .map((r) => ({ tmdb: Number(r.tmdb.value), year: Number(r.won?.value ?? r.made?.value ?? 0) }))
    .filter((f) => Number.isInteger(f.tmdb) && f.tmdb > 0)
    .sort((x, y) => y.year - x.year || x.tmdb - y.tmdb);
  const ids = [...new Set(films.map((f) => f.tmdb))];
  console.log(`${a.name}: ${ids.length} films`);
  lists.push({ id: a.id, name: a.name, note: a.note, ids });
}

const body = lists
  .map((l) => {
    const rows = [];
    for (let i = 0; i < l.ids.length; i += 12) rows.push(`        ${l.ids.slice(i, i + 12).join(', ')},`);
    return [
      '  {',
      `    id: '${l.id}',`,
      `    name: '${l.name}',`,
      `    note: '${l.note}',`,
      '    q: {',
      "      kind: 'movie',",
      '      ids: [',
      ...rows,
      '      ],',
      '    },',
      '  },',
    ].join('\n');
  })
  .join('\n');

writeFileSync(
  new URL('../src/lib/awards.ts', import.meta.url),
  `// Made by scripts/make-awards.mjs from Wikidata (CC0) on ${new Date().toISOString().slice(0, 10)}. Don't edit by hand: run the script.
import type { Shelf } from '@/lib/discover';

/** Award winners as fixed lists of TMDB ids, newest first. */
export const AWARD_LISTS: Shelf[] = [
${body}
];
`,
);
