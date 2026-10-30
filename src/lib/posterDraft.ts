import { useEffect } from 'react';

/**
 * A poster chosen before the entry exists (on the log screen): the poster screen leaves it here and goes
 * back, and the log screen picks it up for its draft.
 */
type Chosen = { sourceId: string; posterUrl: string | null; posterPick: string | null };

let chosen: Chosen | null = null;
const listeners = new Set<() => void>();

export function choosePosterForDraft(c: Chosen) {
  chosen = c;
  listeners.forEach((l) => l());
}

/**
 * Takes the choice for this title, if there is one, and clears it. A plain function (not inside the hook)
 * so the read happens before the clear: the React Compiler rewrites hooks, and inside one it read the
 * cleared value.
 */
function takeChosen(sourceId: string): Chosen | null {
  if (!chosen || chosen.sourceId !== sourceId) return null;
  const c: Chosen = { ...chosen };
  chosen = null;
  return c;
}

/** Calls `apply` when a poster is chosen for this title's draft (once per choice). */
export function useDraftPoster(sourceId: string, apply: (c: Chosen) => void) {
  useEffect(() => {
    const take = () => {
      const c = takeChosen(sourceId);
      if (c) apply(c);
    };
    listeners.add(take);
    take();
    return () => {
      listeners.delete(take);
    };
  }, [sourceId, apply]);
}
