// Merging a show changed on two phones: ticks, unticks, and records from older app versions.
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Days are local calendar days, so pin the zone.
process.env.TZ = 'Asia/Kolkata';

const { mergeTrack, stamped, MOST_CHANGES, CHANGES_KEPT_MS } = await import('@/lib/tracking');

type Track = Parameters<typeof mergeTrack>[0];

const DAY = 24 * 60 * 60 * 1000;
// Noon on 10 Nov 2026 in Kolkata.
const T = Date.parse('2026-11-10T12:00:00+05:30');

const show = (over: Partial<Track> = {}): Track => ({
  status: 'watching',
  seen: {},
  seasons: [{ n: 1, count: 10 }],
  lastAired: { season: 1, number: 10 },
  nextAir: null,
  ended: false,
  checkedAt: 0,
  startedAt: 0,
  ...over,
});

/** Today's merge, before untick times: a plain union of ticks and ratings. */
const unionOf = (mine: Track, theirs: Track) => ({ seen: { ...theirs.seen, ...mine.seen }, ratings: { ...theirs.ratings, ...mine.ratings } });

test('records without times merge exactly as before', () => {
  const mine = show({ seen: { s1e1: '2026-11-01', s1e2: '2026-11-02' }, ratings: { s1e1: 8 } });
  const theirs = show({ seen: { s1e2: '2026-11-03', s1e3: '2026-11-04' }, ratings: { s1e3: 6, s1e1: 4 }, checkedAt: 5 });
  const merged = mergeTrack(mine, theirs);
  assert.deepEqual({ seen: merged.seen, ratings: merged.ratings }, unionOf(mine, theirs));
  assert.equal('changed' in merged, false, 'no times appear from nowhere');
  assert.equal(merged.checkedAt, 5, 'the newer details still win');
});

test('an untick here beats an older tick on the other phone', () => {
  // Both had s1e3; this phone unticked it, the other ticked s1e4 offline.
  const before = show({ seen: { s1e3: '2026-11-05' } });
  const mine = stamped(before, show({ seen: {} }), T);
  const theirs = stamped(before, show({ seen: { s1e3: '2026-11-05', s1e4: '2026-11-10' } }), T - 60_000);
  const merged = mergeTrack(mine, theirs);
  assert.deepEqual(merged.seen, { s1e4: '2026-11-10' });
  // And the same from the other phone's side.
  assert.deepEqual(mergeTrack(theirs, mine).seen, { s1e4: '2026-11-10' });
});

test('a tick after the untick wins', () => {
  const before = show({ seen: { s1e3: '2026-11-05' } });
  const mine = stamped(before, show({ seen: {} }), T);
  const theirs = stamped(show({ seen: {} }), show({ seen: { s1e3: '2026-11-10' } }), T + 60_000);
  assert.deepEqual(mergeTrack(mine, theirs).seen, { s1e3: '2026-11-10' });
  assert.deepEqual(mergeTrack(theirs, mine).seen, { s1e3: '2026-11-10' });
});

test('an untick drops that episode’s stars too', () => {
  const before = show({ seen: { s1e3: '2026-11-05' }, ratings: { s1e3: 9 } });
  const mine = stamped(before, show({ seen: {}, ratings: {} }), T);
  const merged = mergeTrack(mine, before);
  assert.deepEqual(merged.seen, {});
  assert.deepEqual(merged.ratings, {});
});

test('an old app’s tick (no time) stays only if it is from a later day than the untick', () => {
  const mine = stamped(show({ seen: { s1e3: '2026-11-05' } }), show({ seen: {} }), T);
  // Ticked on an older version, before the untick: the untick wins.
  assert.deepEqual(mergeTrack(mine, show({ seen: { s1e3: '2026-11-05' } })).seen, {});
  // Ticked on an older version the same day: treated as before the untick.
  assert.deepEqual(mergeTrack(mine, show({ seen: { s1e3: '2026-11-10' } })).seen, {});
  // Ticked on an older version a later day: the tick wins, and the episode merges as before from then on.
  const later = mergeTrack(mine, show({ seen: { s1e3: '2026-11-11' } }));
  assert.deepEqual(later.seen, { s1e3: '2026-11-11' });
  assert.equal(later.changed?.s1e3, undefined);
});

test('an old app that kept a stale time and re-ticked keeps its tick (a tie keeps ticks)', () => {
  const mine = stamped(show({ seen: { s1e3: '2026-11-05' } }), show({ seen: {} }), T);
  const oldApp = { ...mine, seen: { s1e3: '2026-11-12' } };
  assert.deepEqual(mergeTrack(mine, oldApp).seen, { s1e3: '2026-11-12' });
});

test('episodes nobody changed are untouched, and the merged times take the newer of each', () => {
  const mine = show({ seen: { s1e1: '2026-11-01' }, changed: { s1e1: T - DAY, s1e2: T } });
  const theirs = show({ seen: { s1e1: '2026-11-01', s1e5: '2026-11-02' }, changed: { s1e1: T, s1e2: T - DAY } });
  const merged = mergeTrack(mine, theirs);
  assert.deepEqual(merged.seen, { s1e1: '2026-11-01', s1e5: '2026-11-02' });
  assert.deepEqual(merged.changed, { s1e1: T, s1e2: T });
});

test('the status settles after a merge', () => {
  const all = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`s1e${i + 1}`, '2026-11-01']));
  const done = show({ ended: true, status: 'completed', seen: all });
  const rest = { ...all };
  delete rest.s1e10;
  const unticked = stamped(done, { ...done, seen: rest }, T);
  const merged = mergeTrack(unticked, done);
  assert.equal(merged.seen.s1e10, undefined);
  assert.equal(merged.status, 'watching');
});

test('stamped times only what changed, and nothing when nothing did', () => {
  const before = show({ seen: { s1e1: '2026-11-01' } });
  const same = show({ seen: { s1e1: '2026-11-01' }, status: 'paused' });
  assert.equal(stamped(before, same, T), same);
  const next = stamped(before, show({ seen: { s1e1: '2026-11-01', s1e2: '2026-11-10' } }), T);
  assert.deepEqual(next.changed, { s1e2: T });
  assert.deepEqual(stamped(undefined, show({ seen: { s1e1: '2026-11-10' } }), T).changed, { s1e1: T });
});

test('the times are capped and old ones go', () => {
  const many = Object.fromEntries(Array.from({ length: MOST_CHANGES + 50 }, (_, i) => [`s1e${i + 1}`, '2026-11-10']));
  const big = stamped(show(), show({ seen: many }), T);
  assert.equal(Object.keys(big.changed ?? {}).length, MOST_CHANGES);
  const old = show({ seen: {}, changed: { s1e1: T - CHANGES_KEPT_MS - 1 } });
  const next = stamped(old, show({ seen: { s1e2: '2026-11-10' }, changed: old.changed }), T);
  assert.deepEqual(next.changed, { s1e2: T });
  // A merge caps too.
  const a = show({ changed: Object.fromEntries(Array.from({ length: MOST_CHANGES }, (_, i) => [`s1e${i + 1}`, T + i])) });
  const b = show({ changed: Object.fromEntries(Array.from({ length: MOST_CHANGES }, (_, i) => [`s2e${i + 1}`, T - i - 1])) });
  const merged = mergeTrack(a, b);
  assert.equal(Object.keys(merged.changed ?? {}).length, MOST_CHANGES);
  assert.ok(Object.keys(merged.changed ?? {}).every((k) => k.startsWith('s1e')), 'the newest are kept');
});
