import { isoDate, parseIso } from '@/lib/dates';
import { computeStats, episodesIn } from '@/lib/stats';
import type { Entry, MediaKind } from '@/store/types';

// Everything the profile shows, worked out from the diary. Pure, so it's easy to check.

export type Tier = 'wood' | 'iron' | 'silver' | 'gold' | 'platinum';
export type Achievement = {
  id: string;
  name: string;
  /** What it takes, e.g. "Watch 50 films". */
  goal: string;
  icon: string;
  /** The highest tier reached, or null while still locked. */
  tier: Tier | null;
  /** Towards the next tier (or the last one, once it's all done). */
  progress: number;
  next: number;
};

export type ProfileStats = {
  /** Different titles, by kind (a rewatch doesn't count twice). */
  titles: Record<MediaKind, number>;
  viewings: number;
  hours: number;
  episodes: number;
  reviews: number;
  loved: number;
  avgStars: number | null;
  ratings: number[];
  topGenres: { name: string; count: number }[];
  /** Directors (films) and studios or networks (series, anime). */
  topCredits: { name: string; count: number }[];
  /** Viewings per day for the last 53 weeks, oldest first, each week Monday to Sunday. */
  weeks: { date: string; count: number; future: boolean }[][];
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  /** The day with the most episodes (or viewings) logged. */
  binge: { date: string; episodes: number } | null;
  busiestMonth: { key: string; count: number } | null;
  /** Viewings dated this calendar year. */
  thisYear: number;
  achievements: Achievement[];
};

const TIERS: Tier[] = ['wood', 'iron', 'silver', 'gold', 'platinum'];
export const TIER_COLORS: Record<Tier, string> = { wood: '#B07A4A', iron: '#9AA3AD', silver: '#D6DCE4', gold: '#F2B84B', platinum: '#9BE7F0' };

const DAY = 24 * 60 * 60 * 1000;
const titleKey = (e: Entry) => (e.source !== 'manual' && e.sourceId ? `${e.source}:${e.sourceId}` : `${e.kind}:${e.title.toLowerCase()}:${e.year ?? ''}`);

function top(map: Map<string, number>, n: number) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

function achieve(id: string, name: string, goal: (n: number) => string, icon: string, value: number, steps: number[]): Achievement {
  const reached = steps.filter((s) => value >= s).length;
  const next = steps[Math.min(reached, steps.length - 1)];
  return { id, name, goal: goal(next), icon, tier: reached ? TIERS[reached - 1] : null, progress: Math.min(value, next), next };
}

export function profileStats(all: Entry[], todayIso: string): ProfileStats {
  const stats = computeStats(all);
  const dated = all.filter((e) => !e.undated);

  const titles: Record<MediaKind, number> = { movie: 0, tv: 0, anime: 0 };
  const seen = new Set<string>();
  for (const e of all) {
    const k = titleKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    titles[e.kind]++;
  }

  const genres = new Map<string, number>();
  const credits = new Map<string, number>();
  for (const e of all) {
    for (const g of e.genres) genres.set(g, (genres.get(g) ?? 0) + 1);
    if (e.credit) credits.set(e.credit, (credits.get(e.credit) ?? 0) + 1);
  }

  // Per day: viewings, and episodes for the binge record.
  const perDay = new Map<string, number>();
  const episodesPerDay = new Map<string, number>();
  let episodes = 0;
  for (const e of dated) {
    perDay.set(e.watchedOn, (perDay.get(e.watchedOn) ?? 0) + 1);
    const eps = e.kind === 'movie' ? 0 : episodesIn(e.progress);
    episodes += eps;
    episodesPerDay.set(e.watchedOn, (episodesPerDay.get(e.watchedOn) ?? 0) + (eps || 1));
  }
  for (const e of all) if (e.undated && e.kind !== 'movie') episodes += episodesIn(e.progress);

  // 53 weeks ending with this week, Monday first.
  const end = parseIso(todayIso);
  const mondayOffset = (end.getDay() + 6) % 7;
  const start = new Date(end.getTime() - (mondayOffset + 52 * 7) * DAY);
  const weeks: ProfileStats['weeks'] = [];
  for (let w = 0; w < 53; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      const iso = isoDate(day);
      week.push({ date: iso, count: perDay.get(iso) ?? 0, future: iso > todayIso });
    }
    weeks.push(week);
  }

  // Streaks of consecutive days with something logged.
  const days = [...perDay.keys()].sort();
  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && isoDate(new Date(parseIso(prev).getTime() + DAY + 2 * 60 * 60 * 1000)) === d ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prev = d;
  }
  let currentStreak = 0;
  for (let d = new Date(end); ; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)) {
    const iso = isoDate(d);
    if (perDay.has(iso)) currentStreak++;
    else if (iso !== todayIso) break; // today without a log yet doesn't break it
  }

  const bingeDay = [...episodesPerDay.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0];
  const months = new Map<string, number>();
  for (const e of dated) months.set(e.watchedOn.slice(0, 7), (months.get(e.watchedOn.slice(0, 7)) ?? 0) + 1);
  const busiest = [...months.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0];
  const year = todayIso.slice(0, 4);
  const hours = Math.round(stats.minutes / 60);
  const horror = all.filter((e) => e.genres.includes('Horror')).length;
  const ghibli = all.filter((e) => /ghibli/i.test(e.credit ?? '')).length;

  const achievements = [
    achieve('projector', 'The Projector', (n) => `Watch ${n} films`, 'film', titles.movie, [5, 25, 100, 250, 500]),
    achieve('remote', 'The Remote', (n) => `Watch ${n} series`, 'tv', titles.tv, [3, 10, 25, 50, 100]),
    achieve('otaku', 'Otaku', (n) => `Watch ${n} anime`, 'sparkles', titles.anime, [3, 10, 25, 75, 150]),
    achieve('binge', 'Binge Watcher', (n) => `${n} episodes in one day`, 'flash', bingeDay?.[1] ?? 0, [3, 6, 10, 15, 24]),
    achieve('critic', 'The Critic', (n) => `Write ${n} reviews`, 'create', stats.reviews, [1, 10, 50, 150, 365]),
    achieve('hearts', 'Big Heart', (n) => `Love ${n} titles`, 'heart', stats.liked, [1, 10, 50, 100, 250]),
    achieve('streak', 'Every Night', (n) => `A ${n}-day streak`, 'flame', longestStreak, [3, 7, 14, 30, 100]),
    achieve('hours', 'Screen Time', (n) => `${n} hours watched`, 'time', hours, [10, 50, 200, 500, 1000]),
    achieve('rewatch', 'Again!', (n) => `${n} rewatches`, 'repeat', stats.rewatches, [1, 5, 20, 50, 100]),
    achieve('night', 'After Midnight', (n) => `${n} horror titles`, 'moon', horror, [1, 5, 15, 40, 100]),
    achieve('ghibli', 'Spirited', (n) => `${n} Studio Ghibli films`, 'leaf', ghibli, [1, 3, 6, 12, 20]),
    achieve('rounded', 'All-Rounder', (n) => `${n} of each: film, series, anime`, 'apps', Math.min(titles.movie, titles.tv, titles.anime), [1, 5, 15, 40, 100]),
  ];

  return {
    titles,
    viewings: all.length,
    hours,
    episodes,
    reviews: stats.reviews,
    loved: stats.liked,
    avgStars: stats.avgStars,
    ratings: stats.ratings,
    topGenres: top(genres, 5),
    topCredits: top(credits, 5),
    weeks,
    activeDays: perDay.size,
    currentStreak,
    longestStreak,
    binge: bingeDay ? { date: bingeDay[0], episodes: bingeDay[1] } : null,
    busiestMonth: busiest ? { key: busiest[0], count: busiest[1] } : null,
    thisYear: dated.filter((e) => e.watchedOn.startsWith(year)).length,
    achievements,
  };
}
