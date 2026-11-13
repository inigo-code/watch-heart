// Reading saved data at launch can fail for a moment (the phone busy, storage not ready yet). A store whose
// read failed must never save its empty starting state over what's really there, so it tries again first.

/** The waits between tries of a read that failed: a short hiccup costs a second or two, then the store gives up. */
export const READ_RETRY_MS = [300, 1000, 3000] as const;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** `read`, tried again after each of `waits` while it fails. Rejects with the last error once they run out. */
export async function withRetries<T>(read: () => Promise<T>, waits: readonly number[] = READ_RETRY_MS, sleep: (ms: number) => Promise<void> = pause): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await read();
    } catch (e) {
      if (i >= waits.length) throw e;
      await sleep(waits[i]);
    }
  }
}
