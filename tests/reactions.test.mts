// Emoji reactions on comments: what a pick does to the counts, and what goes to the server.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { COMMENT_REACTIONS, myReaction, pickReaction, sortReactions } = await import('@/lib/reactions');

test('six film-friendly reactions, in a fixed order', () => {
  assert.deepEqual([...COMMENT_REACTIONS], ['❤️', '😂', '😮', '😢', '🍿', '🔥']);
});

test('a first pick adds yours', () => {
  assert.deepEqual(pickReaction(undefined, '🍿'), { list: [{ emoji: '🍿', count: 1, mine: true }], send: '🍿' });
  assert.deepEqual(pickReaction([{ emoji: '🍿', count: 2, mine: false }], '🍿'), { list: [{ emoji: '🍿', count: 3, mine: true }], send: '🍿' });
});

test('picking another moves yours, and an emptied one goes', () => {
  const { list, send } = pickReaction([{ emoji: '😂', count: 1, mine: true }, { emoji: '🔥', count: 2, mine: false }], '🔥');
  assert.equal(send, '🔥');
  assert.deepEqual(list, [{ emoji: '🔥', count: 3, mine: true }]);
});

test('the same one again takes it off', () => {
  const { list, send } = pickReaction([{ emoji: '❤️', count: 3, mine: true }], '❤️');
  assert.equal(send, null);
  assert.deepEqual(list, [{ emoji: '❤️', count: 2, mine: false }]);
  assert.equal(myReaction(list), null);
});

test('most first, then the picker order', () => {
  const sorted = sortReactions([
    { emoji: '🔥', count: 1, mine: false },
    { emoji: '😂', count: 1, mine: false },
    { emoji: '🍿', count: 4, mine: false },
  ]);
  assert.deepEqual(sorted.map((r) => r.emoji), ['🍿', '😂', '🔥']);
});
