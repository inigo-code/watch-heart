import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { watchRegion } from '@/api/omdb';
import { releaseDay } from '@/api/tmdb';
import { startBackgroundCheck } from '@/lib/backgroundCheck';
import { applyNudges } from '@/lib/nudgeSchedule';
import { planNudges, releaseDue } from '@/lib/nudges';
import { useTracker } from '@/lib/useTracker';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';

// A moment after things settle, so a burst of changes schedules once.
const SETTLE_MS = 3000;
const RELEASE_BATCH = 6;
const SHOW_BATCH = 6;
const SHOW_STALE_MS = 12 * 60 * 60 * 1000;

/** Keeps the phone's scheduled notifications in step with your diary, each time the app opens or anything changes. */
export function useNudges(fresh: { title: string; sourceId: string } | null) {
  const { settings, ready: settingsReady } = useSettings();
  const { entries, watchlist, ready: diaryReady, updateWatchItem } = useDiary();
  // Not on default settings that stand in for ones that couldn't be read: they'd bring back alerts you turned off.
  const ready = diaryReady && settingsReady;
  const [opened, setOpened] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setOpened((n) => n + 1));
    return () => sub.remove();
  }, []);
  const { refresh } = useTracker();
  useEffect(() => {
    startBackgroundCheck().catch(() => {});
  }, []);
  const { episodes, picks, recap, releases } = settings.nudges;

  // Air dates for tracked shows, whenever the app opens, a few shows at a time.
  const refreshing = useRef(false);
  useEffect(() => {
    if (!ready || refreshing.current) return;
    const stale = watchlist.filter((w) => w.track && w.track.status !== 'dropped' && Date.now() - w.track.checkedAt > SHOW_STALE_MS).slice(0, SHOW_BATCH);
    if (!stale.length) return;
    refreshing.current = true;
    const check = (w: (typeof stale)[number]) =>
      refresh(w)
        .then(() => true)
        .catch(() => false);
    void Promise.all(stale.map(check)).then((done) => {
      refreshing.current = false;
      if (done.some(Boolean)) setOpened((n) => n + 1);
    });
  }, [ready, opened, watchlist, refresh]);

  // Release dates for titles added before they're out, a few at a time.
  const looking = useRef(false);
  const { tmdbKey, watchRegion: regionSetting } = settings;
  useEffect(() => {
    if (!ready || !releases || looking.current) return;
    const due = watchlist.filter((w) => releaseDue(w, new Date())).slice(0, RELEASE_BATCH);
    if (!due.length) return;
    looking.current = true;
    const region = watchRegion(regionSetting);
    const lookUp = (w: (typeof due)[number]) =>
      releaseDay(tmdbKey, w.sourceId, region)
        .then((releaseDate) => {
          updateWatchItem(w.id, { releaseDate, releaseCheckedAt: Date.now() }, { quiet: true });
          return true;
        })
        .catch(() => false);
    void Promise.all(due.map(lookUp)).then((done) => {
      looking.current = false;
      // On to the next few. Not when offline, or this would never stop.
      if (done.some(Boolean)) setOpened((n) => n + 1);
    });
  }, [ready, opened, releases, watchlist, tmdbKey, regionSetting, updateWatchItem]);

  const freshId = fresh?.sourceId;
  const freshTitle = fresh?.title;
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const now = freshId && freshTitle ? { title: freshTitle, sourceId: freshId } : null;
      applyNudges(planNudges({ now: new Date(), entries, watchlist, fresh: now, episodes, picks, recap, releases })).catch(() => {});
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [ready, opened, entries, watchlist, freshId, freshTitle, episodes, picks, recap, releases]);
}
