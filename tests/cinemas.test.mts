import assert from 'node:assert/strict';
import { test } from 'node:test';

import { stillInCinemas } from '../src/lib/regional.ts';

test('in India, Indian films stay in cinemas five weeks and foreign ones three', () => {
  // Hope (Korean) opened in India on 23 October: gone by 22 November.
  assert.equal(stillInCinemas('IN', 'ko', '2026-10-23', '2026-11-22'), false);
  assert.equal(stillInCinemas('IN', 'ko', '2026-11-01', '2026-11-22'), true);
  assert.equal(stillInCinemas('IN', 'en', '2026-10-31', '2026-11-22'), false);
  assert.equal(stillInCinemas('IN', 'ta', '2026-10-23', '2026-11-22'), true);
  assert.equal(stillInCinemas('IN', 'mr', '2026-10-18', '2026-11-22'), true);
  assert.equal(stillInCinemas('IN', 'hi', '2026-10-17', '2026-11-22'), false);
});

test('elsewhere every film keeps five weeks; no date or a future one is not showing', () => {
  assert.equal(stillInCinemas('US', 'ko', '2026-10-23', '2026-11-22'), true);
  assert.equal(stillInCinemas('IN', 'ta', undefined, '2026-11-22'), false);
  assert.equal(stillInCinemas('IN', 'ta', '2026-11-23', '2026-11-22'), false);
  assert.equal(stillInCinemas('IN', undefined, '2026-11-10', '2026-11-22'), true);
});
