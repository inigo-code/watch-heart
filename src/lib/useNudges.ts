import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { applyNudges } from '@/lib/nudgeSchedule';
import { planNudges } from '@/lib/nudges';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';

// A moment after things settle, so a burst of changes schedules once.
const SETTLE_MS = 3000;

/** Keeps the phone's scheduled notifications in step with your diary, each time the app opens or anything changes. */
export function useNudges(fresh: { title: string; sourceId: string } | null) {
  const { settings } = useSettings();
  const { entries, watchlist, ready } = useDiary();
  const [opened, setOpened] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setOpened((n) => n + 1));
    return () => sub.remove();
  }, []);
  const { episodes, picks, recap } = settings.nudges;
  const freshId = fresh?.sourceId;
  const freshTitle = fresh?.title;
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const now = freshId && freshTitle ? { title: freshTitle, sourceId: freshId } : null;
      applyNudges(planNudges({ now: new Date(), entries, watchlist, fresh: now, episodes, picks, recap })).catch(() => {});
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [ready, opened, entries, watchlist, freshId, freshTitle, episodes, picks, recap]);
}
