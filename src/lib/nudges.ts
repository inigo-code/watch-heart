// What the app will tell you, and when: worked out from what it already knows, so nothing leaves the phone.
// At most a few a week, and each says something true about your own viewing or what's new.

import { seasonOn } from '@/lib/tracking';

export type Nudge = { id: string; at: Date; title: string; body: string; url: string };

type Coming = { season: number; number: number; date: string; at?: string };
type Show = {
  id: string;
  title: string;
  source: string;
  sourceId: string;
  year?: number | null;
  releaseDate?: string | null;
  releaseCheckedAt?: number | null;
  track?: { status: string; seen: Record<string, string>; nextAir: Coming | null; upcoming?: Coming[] };
};

export type NudgeInput = {
  now: Date;
  entries: { watchedOn: string; undated?: boolean }[];
  watchlist: Show[];
  /** Something new from Home: this week's film from your country, or the top of trending. */
  fresh: { title: string; sourceId: string } | null;
  episodes: boolean;
  picks: boolean;
  recap: boolean;
  releases: boolean;
};

const MOST_EPISODES = 30;
const MOST_RELEASES = 20;
const QUIET_DAYS = 6;
const TUESDAY = 2;
const FRIDAY = 5;
const DAY = 24 * 60 * 60 * 1000;
const MORNING = 8;
const LATE = 23;
const RELEASE_HOUR = 10;

const dayOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const onDay = (iso: string, hour: number, minute = 0) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute);
};

/** When to say so: the moment it airs if that's known, held to the morning if it's the middle of the night. */
function alertTime(e: Coming) {
  if (!e.at) return onDay(e.date, 18, 30);
  const at = new Date(e.at);
  const hour = at.getHours();
  if (hour >= LATE) return new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1, MORNING);
  return hour < MORNING ? new Date(at.getFullYear(), at.getMonth(), at.getDate(), MORNING) : at;
}

/** Whether to look up a watchlist title's release date: not yet out, and not checked today. */
export function releaseDue(w: Show, now: Date) {
  if (w.track || w.source !== 'tmdb' || !w.sourceId) return false;
  if (w.year && w.year < now.getFullYear()) return false;
  if (w.releaseCheckedAt && w.releaseDate && w.releaseDate <= dayOf(now)) return false;
  return now.getTime() - (w.releaseCheckedAt ?? 0) > DAY;
}

const titlePage = (sourceId: string) => `/title/${encodeURIComponent(sourceId)}`;

/** The next time this weekday comes round at this hour, after now. */
function nextWeekday(now: Date, weekday: number, hour: number) {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((weekday - now.getDay() + 7) % 7), hour);
  if (at <= now) at.setDate(at.getDate() + 7);
  return at;
}

/** A pick that stays the same all week and changes the next. */
function ofTheWeek<T>(list: T[], now: Date) {
  const week = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  return list[week % list.length];
}

/** Everything to schedule from here on. Planning again replaces all of it, so it's always up to date. */
export function planNudges({ now, entries, watchlist, fresh, episodes, picks, recap, releases }: NudgeInput): Nudge[] {
  const out: Nudge[] = [];

  if (episodes) {
    // The season you're on, to its end. Then quiet: one word when the next season starts, and nothing more until you start it.
    const coming = watchlist
      .filter((w) => w.track && (w.track.status === 'watching' || w.track.status === 'paused'))
      .flatMap((w) => {
        const t = w.track!;
        const season = seasonOn(t.seen);
        const known = t.upcoming?.length ? t.upcoming : t.nextAir ? [t.nextAir] : [];
        return known.filter((e) => e.season === season || (e.season === season + 1 && e.number === 1)).map((air) => ({ w, air, at: alertTime(air), premiere: air.season > season }));
      })
      .filter((x) => x.at > now)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, MOST_EPISODES);
    for (const { w, air, at, premiere } of coming) {
      out.push({
        id: `nudge-ep-${w.id}-s${air.season}e${air.number}`,
        at,
        title: premiere ? 'New season' : 'New episode',
        body: premiere ? `Season ${air.season} of ${w.title} starts today` : `S${air.season} E${air.number} of ${w.title} is out`,
        url: `/track?id=${encodeURIComponent(w.id)}`,
      });
    }
  }

  if (releases) {
    const coming = watchlist
      .filter((w) => !w.track && w.source === 'tmdb' && w.releaseDate)
      .map((w) => ({ w, at: onDay(w.releaseDate!, RELEASE_HOUR) }))
      .filter((x) => x.at > now)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, MOST_RELEASES);
    for (const { w, at } of coming) {
      out.push({ id: `nudge-release-${w.id}`, at, title: 'Out today', body: `${w.title} from your watchlist is out today`, url: titlePage(w.sourceId) });
    }
  }

  if (picks) {
    const queue = watchlist.filter((w) => !w.track && w.source === 'tmdb' && w.sourceId && !(w.releaseDate && w.releaseDate > dayOf(now)));
    if (queue.length) {
      const pick = ofTheWeek(queue, now);
      out.push({ id: 'nudge-weekend', at: nextWeekday(now, FRIDAY, 19), title: 'Weekend pick', body: `${pick.title} is waiting on your watchlist`, url: titlePage(pick.sourceId) });
    } else if (fresh) {
      out.push({ id: 'nudge-weekend', at: nextWeekday(now, FRIDAY, 19), title: 'Weekend pick', body: `Everyone’s watching ${fresh.title}`, url: titlePage(fresh.sourceId) });
    }
    if (fresh) out.push({ id: 'nudge-new', at: nextWeekday(now, TUESDAY, 18), title: 'New this week', body: `${fresh.title} has landed`, url: titlePage(fresh.sourceId) });
    // Pushed back every time the app opens, so it only ever reaches someone who's been away.
    const quiet = new Date(now.getFullYear(), now.getMonth(), now.getDate() + QUIET_DAYS, 19, 30);
    out.push({ id: 'nudge-quiet', at: quiet, title: 'Watched anything good?', body: 'Log it before you forget', url: '/search' });
  }

  if (recap) {
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = entries.filter((e) => !e.undated && e.watchedOn.startsWith(key)).length;
    if (count) {
      const month = now.toLocaleDateString('en-GB', { month: 'long' });
      out.push({
        id: 'nudge-recap',
        at: new Date(now.getFullYear(), now.getMonth() + 1, 1, 10),
        title: `Your ${month} recap is ready`,
        body: `${count} ${count === 1 ? 'title' : 'titles'} logged. Take a look.`,
        url: '/recap',
      });
    }
  }
  return out;
}
