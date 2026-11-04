import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

// Planned-watch reminders: a local notification at the time you plan, opening the title. Nothing is asked for
// until you plan one. Android 12 and later hold ordinary alarms back while the phone is idle or the app is
// asleep, sometimes for hours, so a reminder needs its "Alarms & reminders" permission to arrive on time.

const CHANNEL = 'movie-night';

// Shown even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Schedules the reminder; resolves to its id, or null when notifications aren't allowed. */
/** Installs before 1.3.0 don't declare the permission, so Android has no switch to send anyone to. */
export const hasAlarmSwitch = () => (Constants.nativeAppVersion ?? '0').localeCompare('1.3.0', undefined, { numeric: true }) >= 0;

/** Whether reminders can arrive at the exact minute. False where the app doesn't hold the permission. */
export async function canRemindOnTime() {
  const exact = await Notifications.getExactAlarmPermissionsAsync().catch(() => null);
  return !!exact?.granted;
}

/** Sends you to Android's "Alarms & reminders" switch for this app; resolves when you come back. */
export async function askToRemindOnTime() {
  await Notifications.requestExactAlarmPermissionsAsync().catch(() => null);
}

export async function scheduleMovieNight(t: { title: string; sourceId: string }, at: Date): Promise<string | null> {
  const onTime = await canRemindOnTime();
  // Android 13 only asks once a channel exists.
  await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Watch reminders', importance: AndroidImportance.HIGH });
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to watch',
      body: `It’s time for ${t.title}. Lights down, phones away.`,
      data: { url: `/title/${encodeURIComponent(t.sourceId)}` },
    },
    // An alarm-clock trigger survives idle phones and sleeping apps; Android shows its alarm icon until it fires.
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL, delivery: onTime ? 'alarmClock' : 'bestEffort' },
  });
}

export async function cancelMovieNight(id: string | null) {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** Tapping a reminder (even one that launched the app) opens its title. Used once, in the root layout. */
export function useMovieNightTaps() {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = last?.notification.request.content.data?.url;
    if (typeof url === 'string') {
      router.push(url as never);
      Notifications.clearLastNotificationResponse();
    }
  }, [last]);
}
