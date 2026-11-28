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
