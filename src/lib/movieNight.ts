import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

// Movie-night reminders: a local notification at the time you plan, opening the title. Nothing is asked for
// until you plan one, and then only Android's permission to show notifications (no exact-alarm permission,
// so Android may deliver it a minute or two late).

const CHANNEL = 'movie-night';

// Shown even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Schedules the reminder; resolves to its id, or null when notifications aren't allowed. */
export async function scheduleMovieNight(t: { title: string; sourceId: string }, at: Date): Promise<string | null> {
  // Android 13 only asks once a channel exists.
  await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Movie nights', importance: AndroidImportance.HIGH });
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Movie night',
      body: `It’s time for ${t.title}. Lights down, phones away.`,
      data: { url: `/title/${encodeURIComponent(t.sourceId)}` },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
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
