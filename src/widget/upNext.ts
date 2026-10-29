import { friendlyDate } from '@/lib/dates';
import { KIND_LABEL } from '@/lib/stats';
import { buildTheme } from '@/lib/theme';
import type { AccentKey } from '@/settings/SettingsProvider';
import { continueWatching, counts, nextUp } from '@/lib/tracking';
import type { WatchItem } from '@/store/types';

// What the "Up next" home-screen widget shows, worked out in the app and saved, so the widget can draw it
// again (after a reboot, or when it's resized) without the app open.

export type UpNextItem = {
  title: string;
  /** "S2 · E4", or "Film · 2024" for something on the watchlist. */
  line: string;
  /** "3 left", "Back Fri 31 Oct", "On your watchlist". */
  note: string;
  poster: string | null;
  /** Where a tap goes: the episode tracker, or the title's page. */
  uri: string;
};

type Colours = { bg: string; card: string; text: string; muted: string; accent: string; onAccent: string };
/** The app's look: one chosen look, or 'system' to follow the phone's light and dark. */
export type WidgetMode = 'dark' | 'light' | 'system';
export type UpNextSnapshot = { items: UpNextItem[]; dark: Colours; light: Colours; mode: WidgetMode };

export const WIDGET_KEY = 'watchheart/widget-up-next';
export const MAX_ITEMS = 4;

const episode = (s: number, n: number) => `S${s} · E${n}`;
// Widgets keep their pictures in memory; the smallest TMDB poster that still looks sharp.
const small = (url: string | null) => (url ? url.replace('/w342/', '/w154/').replace('/w500/', '/w154/') : null);
const page = (w: WatchItem) => (w.source === 'tmdb' && w.sourceId ? `watchheart://title/${encodeURIComponent(w.sourceId)}` : 'watchheart://watchlist');

/** Shows with an episode waiting first (as Continue watching orders them), then the watchlist, newest first. */
export function upNextSnapshot(watchlist: WatchItem[], todayIso: string, accent: AccentKey, mode: WidgetMode = 'dark'): UpNextSnapshot {
  const items: UpNextItem[] = [];
  const groups = continueWatching(watchlist, todayIso);
  for (const w of [...groups.ongoing, ...groups.oldFriends]) {
    const up = nextUp(w.track!);
    const left = counts(w.track!).left;
    items.push({
      title: w.title,
      line: up ? episode(up.season, up.number) : 'Next episode',
      note: `${left} ${left === 1 ? 'episode' : 'episodes'} left`,
      poster: small(w.posterUrl),
      uri: `watchheart://track?id=${encodeURIComponent(w.id)}`,
    });
  }
  for (const w of groups.comingBack) {
    const next = w.track!.nextAir;
    items.push({
      title: w.title,
      line: next ? episode(next.season, next.number) : 'All caught up',
      note: next ? `Out ${friendlyDate(next.date)}` : 'Waiting for more',
      poster: small(w.posterUrl),
      uri: `watchheart://track?id=${encodeURIComponent(w.id)}`,
    });
  }
  for (const w of [...watchlist].filter((x) => !x.track).sort((a, b) => b.addedAt - a.addedAt)) {
    items.push({
      title: w.title,
      line: [KIND_LABEL[w.kind], w.year].filter(Boolean).join(' · '),
      note: w.note.trim() || 'On your watchlist',
      poster: small(w.posterUrl),
      uri: page(w),
    });
  }
  const colours = (dark: boolean): Colours => {
    const t = buildTheme(dark, accent);
    return { bg: t.bg, card: t.card, text: t.text, muted: t.textMuted, accent: t.accent, onAccent: t.accentText };
  };
  return { items: items.slice(0, MAX_ITEMS), dark: colours(true), light: colours(false), mode };
}
