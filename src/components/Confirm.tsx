import type Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { ActionSheet } from '@/components/ActionSheet';

// Nothing is taken away without asking first (Inigo, 2026-11-27): a plan, a watchlist title, a list item, a
// favourite, a comment, a friend request, a block, a ticked episode. One sheet for the whole app, so any
// screen (or another sheet) can ask: the question, one red button that does it, and Cancel.

export type Ask = {
  /** The question, in full: "Take “Dune” off your watchlist?" */
  title: string;
  /** The red button: "Take it off". */
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** The button that keeps things as they are, when "Cancel" would be unclear: "Keep the plan". */
  keep?: string;
  onConfirm: () => void;
};

const ConfirmCtx = createContext<(ask: Ask) => void>((ask) => ask.onConfirm());

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  // The question stays while the sheet slides away.
  const [open, setOpen] = useState(false);
  const confirm = useCallback((next: Ask) => {
    setAsk(next);
    setOpen(true);
  }, []);
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <ActionSheet
        visible={open}
        title={ask?.title}
        cancelLabel={ask?.keep}
        onClose={() => setOpen(false)}
        actions={ask ? [{ label: ask.label, icon: ask.icon ?? 'trash-outline', destructive: true, onPress: ask.onConfirm }] : []}
      />
    </ConfirmCtx.Provider>
  );
}

/** Asks before something is removed; `onConfirm` runs only on the red button. */
export const useConfirm = () => useContext(ConfirmCtx);

/** Taking a title off the watchlist; a show you track stops being tracked, and the diary keeps its logs. */
export const watchlistAsk = (title: string, tracked: boolean, onConfirm: () => void): Ask =>
  tracked
    ? { title: `Stop tracking “${title}”? It comes off your watchlist; your diary keeps what you’ve logged.`, label: 'Stop tracking', icon: 'close-circle-outline', onConfirm }
    : { title: `Take “${title}” off your watchlist?`, label: 'Take it off', icon: 'bookmark-outline', onConfirm };
