// Episode notes on tickets: how a day's ticks read, and how notes saved with dots before 1.7.0 read now.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { plainProgress, progressLabel } = await import('@/lib/tracking');

test('a day of ticks reads as plain season and episode runs', () => {
  assert.equal(progressLabel(['s1e3', 's1e4', 's1e5']), 'S1 Ep 3–5');
  assert.equal(progressLabel(['s1e3', 's1e7']), 'S1 Ep 3, 7');
  assert.equal(progressLabel(['s2e1', 's1e9', 's1e10']), 'S1 Ep 9–10; S2 Ep 1');
});

test('notes saved with dots read without them', () => {
  assert.equal(plainProgress('S1 · Ep 3–5'), 'S1 Ep 3–5');
  assert.equal(plainProgress('S1 · Ep 9–10 · S2 · Ep 1'), 'S1 Ep 9–10; S2 Ep 1');
  assert.equal(plainProgress('Season 2 · 3 episodes'), 'Season 2, 3 episodes');
  assert.equal(plainProgress('Ep 3/12 · Watching'), 'Ep 3/12, Watching');
  assert.equal(plainProgress('S1 Ep 3–5'), 'S1 Ep 3–5');
});
