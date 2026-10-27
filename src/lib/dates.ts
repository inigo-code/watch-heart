// Diary dates are local calendar days stored as YYYY-MM-DD, so a film logged at 11pm stays on that day.

const pad = (n: number) => String(n).padStart(2, '0');

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return isoDate(new Date());
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

/** Parses YYYY-MM-DD as a local date (new Date('2026-10-27') would be UTC midnight). */
export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** "2026-10" for any date in October 2026. */
export const monthKey = (iso: string) => iso.slice(0, 7);

export function monthName(key: string): string {
  return MONTHS[Number(key.slice(5, 7)) - 1] ?? '';
}

export function monthLabel(key: string): string {
  return `${monthName(key)} ${key.slice(0, 4)}`;
}

export function dayParts(iso: string) {
  const d = parseIso(iso);
  return { day: d.getDate(), weekday: WEEKDAYS[d.getDay()], month: MONTHS[d.getMonth()].slice(0, 3) };
}

/** "Today", "Yesterday", or e.g. "Sat 25 Oct 2026". */
export function friendlyDate(iso: string): string {
  if (iso === today()) return 'Today';
  if (iso === daysAgo(1)) return 'Yesterday';
  const d = parseIso(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** "2 h 15 m", or "45 m". */
export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m} m`;
  return m ? `${h} h ${m} m` : `${h} h`;
}
