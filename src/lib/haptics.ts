import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

import { useSettings } from '@/settings/SettingsProvider';

/**
 * A small tap under the finger for the moments that count, when Settings › Haptics is on:
 * - `tick`: an episode ticked or unticked, a +1;
 * - `step`: the rating moving a half star;
 * - `done`: something logged;
 * - `stamp`: the LOGGED stamp landing on a new entry's ticket.
 */
export type Haptic = 'tick' | 'step' | 'done' | 'stamp';

export function useHaptic() {
  const { settings } = useSettings();
  const on = settings.haptics;
  return useCallback(
    (kind: Haptic) => {
      if (!on) return;
      const run =
        kind === 'step'
          ? Haptics.selectionAsync()
          : kind === 'done'
            ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            : Haptics.impactAsync(kind === 'stamp' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
      run.catch(() => {});
    },
    [on],
  );
}
