// The recap story shows each title once, however many entries it has that month.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { oneEach, computeStats } = await import('@/lib/stats');

type Entry = Parameters<typeof oneEach>[0][number];

let n = 0;
const entry = (over: Partial<Entry>): Entry =>
  ({
    id: `e${++n}`,
    kind: 'anime',
    source: 'tmdb',
    sourceId: '1',
    title: 'Heavy Knight',
    originalTitle: null,
    year: 2026,
    posterUrl: 'https://img/1.jpg',
    backdropUrl: null,
    genres: [],
    runtime: 24,
    credit: null,
    watchedOn: '2026-11-10',
    rating: 0,
    liked: false,
    rewatch: false,
    progress: '',
    review: '',
    spoilers: false,
    tags: [],
    createdAt: n,
    updatedAt: n,
    deletedAt: null,
    ...over,
  }) as Entry;

test('episodes of one show become one title', () => {
  const a = entry({ watchedOn: '2026-11-12', rating: 6 });
  const b = entry({ watchedOn: '2026-11-03', rating: 8, liked: false });
  const c = entry({ watchedOn: '2026-11-20', rating: 4, liked: true });
  const film = entry({ kind: 'movie', sourceId: '9', title: 'Jailer', watchedOn: '2026-11-05' });
  const out = oneEach([a, b, c, film]);
  assert.equal(out.length, 2);
  const show = out.find((e) => e.title === 'Heavy Knight')!;
  assert.equal(show.id, b.id, 'keeps the first entry’s id');
  assert.equal(show.watchedOn, '2026-11-03', 'sits on the first day');
  assert.equal(show.rating, 8, 'shows the best rating');
  assert.equal(show.liked, true, 'a heart if any had one');
  assert.equal(show.progress, '3 episodes');
  assert.equal(out.find((e) => e.title === 'Jailer'), film, 'a single entry is left as it is');
});

test('manual entries group by kind and title', () => {
  const out = oneEach([
    entry({ source: 'manual', sourceId: '', title: 'Home video' }),
    entry({ source: 'manual', sourceId: '', title: 'Home video' }),
    entry({ source: 'manual', sourceId: '', title: 'Home video', kind: 'movie' }),
  ]);
  assert.equal(out.length, 2);
});

test('the story’s title count matches the stats', () => {
  const list = [entry({}), entry({}), entry({ sourceId: '2', title: 'Bleach' })];
  assert.equal(oneEach(list).length, computeStats(list).total);
});
