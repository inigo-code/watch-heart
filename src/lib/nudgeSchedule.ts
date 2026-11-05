import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import type { Nudge } from '@/lib/nudges';

const CHANNEL = 'news';
const PREFIX = 'nudge-';

const channel = () => Notifications.setNotificationChannelAsync(CHANNEL, { name: 'New episodes and picks', importance: AndroidImportance.DEFAULT });

export const canNotify = true;

export async function notificationsAllowed() {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/** Asks Android for permission to notify. */
export async function askForNotifications() {
  // Android 13 only asks once a channel exists.
  await channel();
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Replaces what's scheduled with this plan. Does nothing without permission: this never asks by itself. */
export async function applyNudges(plan: Nudge[]) {
  if (!(await notificationsAllowed())) return;
  await channel();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  await Promise.all(
    plan.map((n) =>
      Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: n.title, body: n.body, data: { url: n.url } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: CHANNEL },
      }),
    ),
  );
}
