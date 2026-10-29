import { useEffect } from 'react';

import { today } from '@/lib/dates';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';

import { upNextSnapshot } from './upNext';
import { updateWidgets } from './widgets';

/** Keeps the home-screen widget in step with the watchlist, episode tracking and the app's look. */
export function WidgetSync() {
  const { ready, watchlist } = useDiary();
  const { settings, ready: settingsReady } = useSettings();
  const { accent, themeMode } = settings;

  useEffect(() => {
    if (!ready || !settingsReady) return;
    // A moment's pause, so a burst of changes (a sync, ticking off episodes) redraws it once.
    const timer = setTimeout(() => {
      updateWidgets(upNextSnapshot(watchlist, today(), accent, themeMode)).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [ready, settingsReady, watchlist, accent, themeMode]);

  return null;
}
