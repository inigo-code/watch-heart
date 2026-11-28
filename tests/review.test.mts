// A review's heading: what counts as written, and the one line a list shows.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { HEADING_MAX, hasReview, headingOf, reviewLine } = await import('@/lib/review');

test('a heading alone counts as a review', () => {
  assert.equal(hasReview({ review: '', heading: 'Creepy and engaging' }), true);
  assert.equal(hasReview({ review: '  ', heading: '   ' }), false);
  assert.equal(hasReview({ review: 'Loved it' }), true);
});

test('a heading is one tidy line, never longer than the limit', () => {
  assert.equal(headingOf({ review: '', heading: '  Slow   burn,\n great end ' }), 'Slow burn, great end');
  assert.equal(headingOf({ review: '', heading: 'x'.repeat(200) }).length, HEADING_MAX);
  assert.equal(headingOf({ review: 'words', heading: null }), '');
});

test('a list shows the heading, or else the review in plain words', () => {
  assert.equal(reviewLine({ review: 'A **gorgeous** film', heading: 'Gorgeous' }), 'Gorgeous');
  assert.equal(reviewLine({ review: 'A **gorgeous**\n\nfilm' }), 'A gorgeous film');
});

const { fitReview, linesFor, paragraphsOf } = await import('@/lib/review');

test('lines are counted the way the words wrap', () => {
  assert.equal(linesFor(['one two three'], 7), 2); // "one two" / "three"
  assert.equal(linesFor(['one', 'two'], 20), 2); // a paragraph starts a line
  assert.equal(linesFor(['abcdefghij'], 4), 3); // a long word is split
  assert.deepEqual(paragraphsOf('A **bold**  line\n\n> a quote'), ['A bold line', 'a quote']);
});

test('a short review gets the biggest size; a longer one a smaller size', () => {
  assert.equal(fitReview('Loved it.', 304, 300).size, 15);
  const long = 'word '.repeat(150);
  const fit = fitReview(long, 304, 300);
  assert.ok(fit.size < 15 && fit.size >= 11 && !fit.cut);
});

test('too long even at the smallest size: as many words as fit, ending in an ellipsis', () => {
  const fit = fitReview('word '.repeat(2000), 304, 300);
  assert.equal(fit.size, 11);
  assert.equal(fit.cut, true);
  const cols = Math.floor((304 * 0.97) / (11 * 0.6));
  assert.ok(linesFor(fit.paragraphs, cols) <= Math.floor(300 / Math.round(11 * 1.45)));
  assert.ok(fit.paragraphs.at(-1)?.endsWith('word…'));
});
