import type { Nudge } from '@/lib/nudges';

// The web preview has no notifications.
export const canNotify = false;
export async function notificationsAllowed() {
  return false;
}
export async function askForNotifications() {
  return false;
}
export async function applyNudges(plan: Nudge[]) {
  void plan;
}
