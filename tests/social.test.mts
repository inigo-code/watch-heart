// Likes and comments put into words: alerts, where they open, and what's been announced.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { excerpt, newsText, newsRoute, unannounced, shortAgo } = await import('@/lib/socialNews');

type News = Parameters<typeof newsText>[0];
const news = (over: Partial<News> = {}): News => ({
  kind: 'comment',
  id: 'comment-1',
  ownerId: 'me',
  entryId: 'e1',
  whoId: 'bosco',
  who: 'Bosco',
  title: 'Past Lives',
  body: 'Loved the ending',
  at: '2026-11-26T10:00:00Z',
  ...over,
});

test('each kind reads as a sentence', () => {
  assert.deepEqual(newsText(news({ kind: 'like', body: null })), { title: 'Bosco liked your entry', body: 'Past Lives' });
  assert.deepEqual(newsText(news()), { title: 'Bosco commented on Past Lives', body: 'Loved the ending' });
  assert.equal(newsText(news({ kind: 'reply', who: 'Asha' })).title, 'Asha replied on Past Lives');
  assert.equal(newsText(news({ kind: 'also' })).title, 'Bosco also commented on Past Lives');
  assert.equal(newsText(news({ title: '' })).title, 'Bosco commented on your entry');
});

test('long comments are cut on a word', () => {
  const long = 'word '.repeat(60);
  const cut = excerpt(long, 40);
  assert.ok(cut.length <= 41);
  assert.ok(cut.endsWith('…'));
  assert.ok(!cut.includes('  '));
  assert.equal(excerpt('  short\n\nline  '), 'short line');
});

test('your own entry opens your entry; a friend’s opens theirs', () => {
  assert.equal(newsRoute({ ownerId: 'me', entryId: 'e1' }, 'me'), '/entry/e1');
  assert.equal(newsRoute({ ownerId: 'asha', entryId: 'e 2' }, 'me'), '/friend-entry/e%202?owner=asha');
});

test('only what wasn’t announced, oldest first, a few at most', () => {
  const list = [1, 2, 3, 4, 5, 6, 7].map((i) => news({ id: `c${i}`, at: `2026-11-2${i}T00:00:00Z` }));
  const { fresh, remember } = unannounced(list, ['c1', 'c2'], 3);
  assert.deepEqual(fresh.map((n) => n.id), ['c5', 'c6', 'c7']);
  assert.ok(remember.includes('c1') && remember.includes('c7'));
  assert.equal(unannounced(list, remember).fresh.length, 0);
});

test('short times', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  assert.equal(shortAgo('2026-11-26T11:59:30Z', now), 'now');
  assert.equal(shortAgo('2026-11-26T11:55:00Z', now), '5m');
  assert.equal(shortAgo('2026-11-26T09:00:00Z', now), '3h');
  assert.equal(shortAgo('2026-11-24T12:00:00Z', now), '2d');
  assert.match(shortAgo('2026-10-01T12:00:00Z', now), /^1 Oct$/);
});
