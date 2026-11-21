// No connection shows plain words, whatever the phone calls it.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { NO_CONNECTION, isOffline, shownError } = await import('@/lib/errors');

test('the wordings of a lost connection all read the same', () => {
  for (const m of [
    'Network request failed',
    'fetch failed: java.net.UnknownHostException: Unable to resolve host "api.tmdb.org": No address associated with hostname',
    'TypeError: Failed to fetch',
    'Load failed',
    'java.net.SocketTimeoutException: timeout',
    'java.net.ConnectException: Failed to connect to /10.0.0.1:443',
    'The Internet connection appears to be offline.',
  ]) {
    assert.ok(isOffline(new Error(m)), m);
    assert.equal(shownError(new Error(m), 'x'), NO_CONNECTION);
  }
});

test('the app’s own messages are kept', () => {
  const m = 'TMDB didn’t accept your key. Check it in Settings.';
  assert.equal(shownError(new Error(m), 'x'), m);
  assert.equal(shownError({ message: 'Wrong email or password.' }, 'x'), 'Wrong email or password.');
});

test('nothing readable gives the fallback', () => {
  assert.equal(shownError(undefined, 'Couldn’t block'), 'Couldn’t block');
  assert.equal(shownError({}, 'Couldn’t block'), 'Couldn’t block');
  assert.equal(shownError(new Error(''), 'Couldn’t block'), 'Couldn’t block');
});

test('a custom offline line', () => {
  assert.equal(shownError(new Error('fetch failed'), 'x', 'No connection.'), 'No connection.');
});
