// Emoji reactions on comments and entries: what a pick does to the counts, and what goes to the server.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { COMMENT_REACTIONS, entryReactions, hasOtherReactions, likeTap, myReaction, pickEntryReaction, pickReaction, reactionFaces, sortReactions } = await import('@/lib/reactions');

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

test('an entry without emoji from the server: its likes are hearts', () => {
  assert.deepEqual(entryReactions({ likes: 3, liked: true }), [{ emoji: '❤️', count: 3, mine: true }]);
  assert.deepEqual(entryReactions({ likes: 0, liked: false }), []);
  assert.equal(likeTap({ likes: 3, liked: true }), '❤️');
  assert.equal(likeTap({ likes: 3, liked: false }), '❤️');
});

test('holding Like and picking an emoji counts as a like', () => {
  const { next, send } = pickEntryReaction({ likes: 2, liked: false, comments: 1 }, '😂');
  assert.equal(send, '😂');
  assert.equal(next.likes, 3);
  assert.equal(next.liked, true);
  assert.equal(next.comments, 1);
  assert.deepEqual(next.reactions, [{ emoji: '❤️', count: 2, mine: false }, { emoji: '😂', count: 1, mine: true }]);
  assert.equal(hasOtherReactions(next.reactions), true);
});

test('tapping Like with an emoji on it takes it off; tapping again gives a heart', () => {
  const s = { likes: 2, liked: true, reactions: [{ emoji: '🔥', count: 1, mine: true }, { emoji: '❤️', count: 1, mine: false }] };
  assert.equal(likeTap(s), '🔥');
  const off = pickEntryReaction(s, likeTap(s));
  assert.equal(off.send, null);
  assert.deepEqual(off.next, { likes: 1, liked: false, reactions: [{ emoji: '❤️', count: 1, mine: false }] });
  const on = pickEntryReaction(off.next, likeTap(off.next));
  assert.equal(on.send, '❤️');
  assert.deepEqual(on.next, { likes: 2, liked: true, reactions: [{ emoji: '❤️', count: 2, mine: true }] });
  assert.equal(hasOtherReactions(on.next.reactions), false);
});

test('the emoji beside the button leave out yours, which the button shows', () => {
  assert.deepEqual(reactionFaces([{ emoji: '🍿', count: 1, mine: true }]), []);
  assert.deepEqual(reactionFaces([{ emoji: '🍿', count: 2, mine: true }, { emoji: '😂', count: 1, mine: false }]), [{ emoji: '😂', count: 1, mine: false }]);
  assert.deepEqual(reactionFaces([{ emoji: '❤️', count: 2, mine: true }]), []);
  assert.deepEqual(reactionFaces([{ emoji: '🔥', count: 1, mine: false }]), [{ emoji: '🔥', count: 1, mine: false }]);
});
