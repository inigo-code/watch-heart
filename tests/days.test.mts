// Episodes seen on a chosen day, or a day you don't remember, and moving them when a viewing's date changes.
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.TZ = 'Asia/Kolkata';

const { UNKNOWN_DAY, seenDay, seasonAired, redated, lastSeenDay, continueWatching, mergeTrack } = await import('@/lib/tracking');

type Track = Parameters<typeof mergeTrack>[0];

const show = (over: Partial<Track> = {}): Track => ({
  status: 'watching',
  seen: {},
  seasons: [
    { n: 1, count: 3 },
    { n: 2, count: 4 },
  ],
  lastAired: { season: 2, number: 2 },
  nextAir: null,
  ended: false,
  checkedAt: 0,
  startedAt: Date.parse('2026-11-16T09:00:00+05:30'),
  ...over,
});

test('a viewing’s day: the day itself, or the unknown day', () => {
  assert.equal(seenDay({ watchedOn: '2026-11-02' }), '2026-11-02');
  assert.equal(seenDay({ watchedOn: '2026-11-16', undated: true }), UNKNOWN_DAY);
  assert.ok(UNKNOWN_DAY < '1900-01-01', 'sorts before any real day');
});

test('a season’s aired episodes stop at the last one aired', () => {
  assert.deepEqual(seasonAired(show(), 1), ['s1e1', 's1e2', 's1e3']);
  assert.deepEqual(seasonAired(show(), 2), ['s2e1', 's2e2']);
  assert.deepEqual(seasonAired(show(), 3), []);
  assert.deepEqual(seasonAired(show({ lastAired: null }), 1), []);
});

test('changing a viewing’s date moves only the episodes seen on its old day', () => {
  const seen = { s1e1: '2026-11-16', s1e2: '2026-11-16', s1e3: '2026-10-01' };
  // The viewing covered all three, but s1e3 was first seen in an earlier viewing.
  assert.deepEqual(redated(seen, ['s1e1', 's1e2', 's1e3'], '2026-11-16', UNKNOWN_DAY), { s1e1: UNKNOWN_DAY, s1e2: UNKNOWN_DAY, s1e3: '2026-10-01' });
  assert.deepEqual(redated(seen, ['s1e1'], '2026-11-16', '2026-09-05'), { ...seen, s1e1: '2026-09-05' });
  assert.deepEqual(redated(seen, ['s9e9'], '2026-11-16', '2026-09-05'), seen, 'an episode no longer ticked stays unticked');
});

test('days you don’t remember don’t count as the last day you watched', () => {
  assert.equal(lastSeenDay(show({ seen: { s1e1: UNKNOWN_DAY, s1e2: '2026-08-01' } })), '2026-08-01');
  // All unknown: the day tracking started.
  assert.equal(lastSeenDay(show({ seen: { s1e1: UNKNOWN_DAY } })), '2026-11-16');
});

test('a show moved back to an old date leaves Ongoing for Old friends', () => {
  const item = (seen: Track['seen']) => ({ id: 'x', track: show({ seen }) }) as unknown as Parameters<typeof continueWatching>[0][number];
  const todaySeen = { s1e1: '2026-11-16', s1e2: '2026-11-16', s1e3: '2026-11-16' };
  assert.equal(continueWatching([item(todaySeen)], '2026-11-16').ongoing.length, 1);
  const moved = redated(todaySeen, Object.keys(todaySeen), '2026-11-16', '2026-06-01');
  const groups = continueWatching([item(moved)], '2026-11-16');
  assert.equal(groups.ongoing.length, 0);
  assert.equal(groups.oldFriends.length, 1);
});

test('an episode seen on an unknown day still counts as seen', () => {
  const t = show({ seen: { s1e1: UNKNOWN_DAY, s1e2: UNKNOWN_DAY, s1e3: UNKNOWN_DAY } });
  const groups = continueWatching([{ id: 'x', track: t } as unknown as Parameters<typeof continueWatching>[0][number]], '2026-11-16');
  // Season 2 has two aired episodes left; started tracking today, so it's ongoing.
  assert.equal(groups.ongoing.length, 1);
});

test('a later real tick beats an unknown day from another phone', () => {
  const mine = show({ seen: { s1e1: UNKNOWN_DAY } });
  const theirs = show({ seen: { s1e1: '2026-11-10' } });
  // Union of ticks: both phones keep the episode seen.
  assert.ok(mergeTrack(mine, theirs).seen.s1e1);
});
