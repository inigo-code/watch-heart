// Reading saved data again after a failure, before a store gives up (and saves nothing).
import assert from 'node:assert/strict';
import { test } from 'node:test';

const { withRetries, READ_RETRY_MS } = await import('@/lib/retry');

/** A read that fails `failures` times, then answers. Counts its tries. */
function flaky(failures: number) {
  const read = async () => {
    read.tries++;
    if (read.tries <= failures) throw new Error(`failure ${read.tries}`);
    return 'saved';
  };
  read.tries = 0;
  return read;
}

/** Records the waits instead of waiting. */
function clock() {
  const waits: number[] = [];
  return { waits, sleep: async (ms: number) => void waits.push(ms) };
}

test('a read that works is tried once, with no wait', async () => {
  const read = flaky(0);
  const { waits, sleep } = clock();
  assert.equal(await withRetries(read, [10, 20], sleep), 'saved');
  assert.equal(read.tries, 1);
  assert.deepEqual(waits, []);
});

test('a read that fails for a moment is tried again after each wait', async () => {
  const read = flaky(2);
  const { waits, sleep } = clock();
  assert.equal(await withRetries(read, [10, 20, 30], sleep), 'saved');
  assert.equal(read.tries, 3);
  assert.deepEqual(waits, [10, 20]);
});

test('a read that keeps failing rejects with its last error once the waits run out', async () => {
  const read = flaky(10);
  const { waits, sleep } = clock();
  await assert.rejects(withRetries(read, [10, 20], sleep), /failure 3/);
  assert.equal(read.tries, 3);
  assert.deepEqual(waits, [10, 20]);
});

test('with no waits, a failure rejects straight away', async () => {
  const read = flaky(1);
  await assert.rejects(withRetries(read, [], async () => assert.fail('no wait expected')), /failure 1/);
  assert.equal(read.tries, 1);
});

test('the app gives up within a few seconds', () => {
  assert.ok(READ_RETRY_MS.length >= 2);
  assert.ok(READ_RETRY_MS.reduce((a, b) => a + b, 0) <= 5000);
});
