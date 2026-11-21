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

test('technical text never reaches the screen', () => {
  for (const m of [
    'java.lang.IllegalStateException: Expected BEGIN_OBJECT',
    "TypeError: Cannot read property 'map' of undefined",
    'JSON Parse error: Unexpected character: <',
    'new row violates row-level security policy for table "entries"',
    'JWT expired',
    '{"code":"PGRST301","message":"bad"}',
    'x'.repeat(200),
    'Friends aren’t set up on the server yet (supabase/friends.sql).',
    'TMDB is having trouble (502).',
  ]) {
    assert.equal(shownError(new Error(m), 'Couldn’t load the posters.'), 'Couldn’t load the posters.', m);
  }
});

test('the app’s own messages all still show', () => {
  for (const m of [
    'TMDB is having trouble. Try again in a moment.',
    "That file isn't a valid backup (it isn't JSON).",
    'Friends aren’t available right now. Try again later.',
    'Allow Watch Heart to save photos, then try again.',
    'Some changes haven’t reached the cloud yet. Connect to the internet and try again.',
    'Confirm your email first: enter the code we sent you.',
    'Movie not found!',
  ]) {
    assert.equal(shownError(new Error(m), 'x'), m);
  }
});
