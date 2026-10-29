// Answers kept for a while in memory, so going back and forth (between tabs, kinds, a list and a title)
// doesn't ask the same question twice. The request itself is kept, so two screens asking at once share
// one; a failed one is forgotten, so the next asks again.

const store = new Map<string, { at: number; value: Promise<unknown> }>();

export function cached<T>(key: string, maxAgeMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { at: Date.now(), value });
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  return value;
}

export const MINUTE = 60_000;
