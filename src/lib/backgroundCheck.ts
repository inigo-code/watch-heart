import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';

import { comingEpisodes, showInfo } from '@/api/episodes';
import { watchRegion } from '@/api/omdb';
import { releaseDay } from '@/api/tmdb';
import { today } from '@/lib/dates';
import { applyNudges } from '@/lib/nudgeSchedule';
import { planNudges, releaseDue } from '@/lib/nudges';
import { storage } from '@/lib/storage';
import { withInfo } from '@/lib/tracking';
import { DEFAULT_SETTINGS, STORAGE_KEY } from '@/settings/SettingsProvider';
import type { Settings } from '@/settings/SettingsProvider';
import { openDiary } from '@/store/db';
import type { WatchItem } from '@/store/types';
import { upNextSnapshot } from '@/widget/upNext';
import { updateWidgets } from '@/widget/widgets';

// Once a day or so, with the app closed: new air dates and release dates, so alerts and the widget stay right
// even if the app isn't opened. Android chooses the moment, and needs a network and enough battery.

const TASK = 'watchheart-air-dates';
const HOURS_BETWEEN = 12;
const MOST_SHOWS = 30;
const MOST_RELEASES = 30;
const STALE_MS = HOURS_BETWEEN * 60 * 60 * 1000;

async function readSettings(): Promise<Settings> {
  const raw = await storage.getItem(STORAGE_KEY);
  const saved = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
  return { ...DEFAULT_SETTINGS, ...saved, nudges: { ...DEFAULT_SETTINGS.nudges, ...saved.nudges } };
}

async function check() {
  // With the app open, it does this itself.
  if (AppState.currentState === 'active') return;
  const settings = await readSettings();
  const db = await openDiary();
  const list = await db.loadWatchlist();
  const fresh = new Map<string, WatchItem>();

  const shows = list.filter((w) => w.track && w.track.status !== 'dropped' && Date.now() - w.track.checkedAt > STALE_MS).slice(0, MOST_SHOWS);
  for (const w of shows) {
    try {
      const info = await showInfo(settings.tmdbKey, w.source, w.sourceId);
      const upcoming = info.nextAir ? await comingEpisodes(settings.tmdbKey, w.source, w.sourceId, info.nextAir).catch(() => undefined) : [];
      fresh.set(w.id, { ...w, track: withInfo(w.track, { ...info, upcoming }, Date.now()) });
    } catch {
      // Offline, or one show's trouble: the next run tries again.
    }
  }

  if (settings.nudges.releases) {
    const region = watchRegion(settings.watchRegion);
    for (const w of list.filter((x) => releaseDue(x, new Date())).slice(0, MOST_RELEASES)) {
      try {
        fresh.set(w.id, { ...w, releaseDate: await releaseDay(settings.tmdbKey, w.sourceId, region), releaseCheckedAt: Date.now() });
      } catch {
        // As above.
      }
    }
  }
  if (!fresh.size) return;

  await db.saveWatchlist([...fresh.values()]);
  const latest = list.map((w) => fresh.get(w.id) ?? w);
  const entries = (await db.load()).filter((e) => e.deletedAt === null);
  const { episodes, releases } = settings.nudges;
  await applyNudges(planNudges({ now: new Date(), entries, watchlist: latest, fresh: null, episodes, releases, picks: false, recap: false }), ['nudge-ep-', 'nudge-release-']);
  await updateWidgets(upNextSnapshot(latest, today(), settings.accent, settings.themeMode)).catch(() => {});
}

/** Called once from the app's entry (index.ts): Android can start this with the app closed. */
export function defineBackgroundCheck() {
  TaskManager.defineTask(TASK, async () => {
    try {
      await check();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Asks Android to run the check. Safe to call on every launch. */
export async function startBackgroundCheck() {
  if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(TASK)) return;
  await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: HOURS_BETWEEN * 60 });
}
