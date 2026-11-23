import { Linking } from 'react-native';

import { shareFile } from '@/lib/backup';
import { APP_NAME } from '@/lib/app';
import type { MovieNight } from '@/settings/SettingsProvider';

// A movie night into your own calendar, as the website's Plan a watch does: a Google Calendar link (opens the
// Calendar app or the browser with the event filled in), or an .ics file for any other calendar app. Nothing
// native, so it ships over the air; writing straight into the phone's calendar would need expo-calendar.

const pad = (n: number) => String(n).padStart(2, '0');
const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
/** How long the event runs: a film two hours, an episode forty-five minutes (a night keeps no runtime). */
const length = (n: MovieNight) => (n.kind === 'movie' ? 120 : 45) * 60_000;

export function openInGoogleCalendar(n: MovieNight) {
  const q = [
    ['action', 'TEMPLATE'],
    ['text', `Watch ${n.title}`],
    ['dates', `${utcStamp(n.at)}/${utcStamp(n.at + length(n))}`],
    ['details', `Planned in ${APP_NAME}`],
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return Linking.openURL(`https://calendar.google.com/calendar/render?${q}`);
}

export function shareCalendarFile(n: MovieNight) {
  const escape = (s: string) => s.replace(/[,;\\]/g, (c) => `\\${c}`);
  const d = new Date(n.at);
  const text = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${APP_NAME}//Movie night//EN`,
    'BEGIN:VEVENT',
    `UID:${n.key}@watchheart.in`,
    `DTSTAMP:${utcStamp(Date.now())}`,
    `DTSTART:${utcStamp(n.at)}`,
    `DTEND:${utcStamp(n.at + length(n))}`,
    `SUMMARY:${escape(`Watch ${n.title}`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Time to watch',
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const name = `${n.title.replace(/[^\w ]+/g, '').trim() || 'movie night'} ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.ics`;
  return shareFile(name, text, 'text/calendar', 'Add to calendar');
}
