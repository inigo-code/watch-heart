// What the app will tell you, and when: worked out from what it already knows, so nothing leaves the phone.
// At most a few a week, and each says something true about your own viewing or what's new.

export type Nudge = { id: string; at: Date; title: string; body: string; url: string };

type Show = { id: string; title: string; source: string; sourceId: string; track?: { status: string; nextAir: { season: number; number: number; date: string } | null } };

export type NudgeInput = {
  now: Date;
  entries: { watchedOn: string; undated?: boolean }[];
  watchlist: Show[];
  /** Something new from Home: this week's film from your country, or the top of trending. */
  fresh: { title: string; sourceId: string } | null;
  episodes: boolean;
  picks: boolean;
  recap: boolean;
};

const MOST_EPISODES = 8;
const QUIET_DAYS = 6;
const TUESDAY = 2;
const FRIDAY = 5;

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
export function planNudges({ now, entries, watchlist, fresh, episodes, picks, recap }: NudgeInput): Nudge[] {
  const out: Nudge[] = [];

  if (episodes) {
    const coming = watchlist
      .filter((w) => w.track?.nextAir && (w.track.status === 'watching' || w.track.status === 'paused'))
      .map((w) => {
        const air = w.track!.nextAir!;
        const [y, m, d] = air.date.split('-').map(Number);
        return { w, air, at: new Date(y, m - 1, d, 18, 30) };
      })
      .filter((x) => x.at > now)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, MOST_EPISODES);
    for (const { w, air, at } of coming) {
      out.push({
        id: `nudge-ep-${w.id}`,
        at,
        title: 'New episode today',
        body: `S${air.season} E${air.number} of ${w.title} is out`,
        url: `/track?id=${encodeURIComponent(w.id)}`,
      });
    }
  }

  if (picks) {
    const queue = watchlist.filter((w) => !w.track && w.source === 'tmdb' && w.sourceId);
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
