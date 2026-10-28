import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentRef, ReactNode } from 'react';
// The story uses React Native's own Image, not expo-image: it has to be drawn into a bitmap when the
// story is captured, and expo-image's hardware bitmaps can't be.
import { Image, StyleSheet, Text, View } from 'react-native';

import { dayParts } from '@/lib/dates';
import { plainText } from '@/lib/richText';
import { computeStats, kindSummary } from '@/lib/stats';
import { fonts } from '@/lib/theme';
import type { Entry } from '@/store/types';

import { PALETTES } from './palettes';
import type { Palette, PaletteKey, StoryLayout } from './palettes';

/** The story is laid out at 360×640 and captured at 1080×1920 (Instagram's story size). */
export const STORY_W = 360;
export const STORY_H = 640;
// Instagram covers the top and bottom of a story with its own UI; keep the important parts inside.
const SAFE_TOP = 58;
const SAFE_BOTTOM = 64;
const PAD = 20;

export type StoryOptions = { layout: StoryLayout; palette: PaletteKey; ratings: boolean; stats: boolean; ranked: boolean };

type Props = {
  entries: Entry[];
  /** The big word on the marquee: "OCTOBER", or "2026" for a year. */
  title: string;
  /** Under the title, e.g. "2026" or "YEAR IN REVIEW". */
  subtitle: string;
  options: StoryOptions;
  /** Called with true once every poster has loaded (or failed), so capture never catches blank frames. */
  onReady?: (ready: boolean) => void;
};

/** Remembers which posters have loaded (or failed) so the story knows when it's ready to capture. */
function useLoadTracker(urls: string[], onReady?: (ready: boolean) => void) {
  const [settledUrls, setSettledUrls] = useState<Set<string>>(() => new Set());
  const settled = useCallback((url: string) => setSettledUrls((s) => (s.has(url) ? s : new Set(s).add(url))), []);
  const ready = urls.every((u) => settledUrls.has(u));
  useEffect(() => onReady?.(ready), [ready, onReady]);
  return settled;
}

/** What a story's ref points at: the view that gets captured. */
export type StoryHandle = ComponentRef<typeof View>;

export const StoryCanvas = forwardRef<StoryHandle, Props>(function StoryCanvas({ entries, title, subtitle, options, onReady }, ref) {
  const p = PALETTES[options.palette];
  const sorted = useMemo(
    () =>
      options.ranked
        ? [...entries].sort((a, b) => b.rating - a.rating || Number(b.liked) - Number(a.liked) || a.watchedOn.localeCompare(b.watchedOn))
        : [...entries].sort((a, b) => a.watchedOn.localeCompare(b.watchedOn) || a.createdAt - b.createdAt),
    [entries, options.ranked],
  );
  const stats = useMemo(() => computeStats(entries), [entries]);
  // The room left between the title and the stats, measured, so any month fits whatever its size.
  const [area, setArea] = useState(0);
  const shown = useMemo(() => (area ? visibleEntries(sorted, options, area) : []), [sorted, options, area]);
  const urls = useMemo(() => {
    const list = shown.map((e) => e.posterUrl).filter((u): u is string => !!u);
    if (options.layout === 'spotlight' && stats.favourite?.posterUrl) list.push(stats.favourite.posterUrl);
    return [...new Set(list)];
  }, [shown, options.layout, stats.favourite]);
  const settled = useLoadTracker(urls, onReady);

  return (
    <View ref={ref} collapsable={false} style={styles.canvas}>
      <LinearGradient colors={p.bg} style={StyleSheet.absoluteFill} />
      {options.layout === 'spotlight' && stats.favourite?.posterUrl && (
        <>
          <Image source={{ uri: stats.favourite.posterUrl }} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} blurRadius={22} resizeMode="cover" />
          <LinearGradient colors={['transparent', p.bg[p.bg.length - 1]]} locations={[0.2, 0.75]} style={StyleSheet.absoluteFill} />
        </>
      )}

      <View style={styles.inner}>
        <Masthead p={p} title={title} subtitle={subtitle} count={entries.length} compact={options.layout === 'spotlight'} />
        <View style={styles.middle} onLayout={(e) => setArea(Math.floor(e.nativeEvent.layout.height))}>
          {area > 0 && options.layout === 'strip' && <Strip p={p} entries={shown} total={sorted.length} options={options} area={area} settled={settled} />}
          {area > 0 && options.layout === 'tickets' && <Tickets p={p} entries={shown} total={sorted.length} options={options} area={area} settled={settled} />}
          {area > 0 && options.layout === 'spotlight' && stats.favourite && (
            <Spotlight p={p} favourite={stats.favourite} rest={shown.filter((e) => e.id !== stats.favourite?.id)} total={sorted.length} options={options} settled={settled} />
          )}
        </View>
        {options.stats && <StatsBar p={p} stats={stats} />}
        <View style={styles.brand}>
          <View style={[styles.brandReel, { borderColor: p.accent }]}>
            <Ionicons name="heart" size={8} color={p.accent} />
          </View>
          <Text style={[styles.brandText, { color: p.muted }]}>WATCH HEART</Text>
        </View>
      </View>
    </View>
  );
});

// How many fit in each layout, given the measured `area` (height) between the title and the stats.
// When not everything fits, the last place goes to a "+N more".
const STRIP_W = STORY_W - PAD * 2 - 20;
// The strip's own height around the posters: two rows of holes, padding and gaps.
const STRIP_CHROME = 6 * 2 + 6 * 2 + 8 * 2;
// Stars under a poster are only drawn while they're big enough to read.
const STARS_MIN_W = 40;
const STARS_H = 12;
const MAX_COLS = 10;
const TICKET_H = 40;
const TICKET_GAP = 5;
const MORE_H = 18;
// One row of small posters under the favourite.
const SPOTLIGHT_REST = 8;

function stripFit(n: number, ratings: boolean, area: number) {
  const height = area - STRIP_CHROME;
  const gap = 6;
  let fit = { w: 0, label: 0, capacity: 0, gap };
  for (let cols = 2; cols <= MAX_COLS; cols++) {
    const w = Math.min(110, (STRIP_W - gap * (cols - 1)) / cols);
    const label = ratings && w >= STARS_MIN_W ? STARS_H : 0;
    const rows = Math.floor((height + gap) / (w * 1.5 + label + gap));
    fit = { w, label, capacity: rows * cols, gap };
    if (fit.capacity >= n) break;
  }
  return fit;
}

function ticketCapacity(n: number, area: number) {
  const all = Math.floor((area + TICKET_GAP) / (TICKET_H + TICKET_GAP));
  // When they don't all fit, the "+N more" line takes some room too.
  return n <= all ? n : Math.floor((area - MORE_H + TICKET_GAP) / (TICKET_H + TICKET_GAP));
}

function visibleEntries(sorted: Entry[], o: StoryOptions, area: number): Entry[] {
  if (o.layout === 'tickets') return sorted.slice(0, ticketCapacity(sorted.length, area));
  const cap = o.layout === 'strip' ? stripFit(sorted.length, o.ratings, area).capacity : SPOTLIGHT_REST + 1;
  return sorted.length > cap ? sorted.slice(0, cap - 1) : sorted;
}

function Masthead({ p, title, subtitle, count, compact }: { p: Palette; title: string; subtitle: string; count: number; compact?: boolean }) {
  // Bebas Neue is about 0.42em per capital; shrink long months (SEPTEMBER) to fit the width.
  // The spotlight keeps the title smaller, to leave the room for the favourite.
  const size = Math.min(compact ? 60 : 104, (STORY_W - PAD * 2) / (title.length * 0.43));
  return (
    <View style={styles.masthead}>
      <Text style={[styles.kicker, { color: p.accent }]}>MY WATCH DIARY</Text>
      <Text style={[styles.title, { color: p.text, fontSize: size, lineHeight: size * 0.98 }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.subtitle, { color: p.muted }]}>
        {subtitle} · {count} {count === 1 ? 'TITLE' : 'TITLES'}
      </Text>
    </View>
  );
}

function Holes({ color, count }: { color: string; count: number }) {
  return (
    <View style={styles.holes}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.hole, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

function StoryStars({ rating, size, color }: { rating: number; size: number; color: string }) {
  if (!rating) return null;
  const out: ReactNode[] = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i * 2) out.push(<Ionicons key={i} name="star" size={size} color={color} />);
    else if (rating === i * 2 - 1) out.push(<Ionicons key={i} name="star-half" size={size} color={color} />);
  }
  return <View style={{ flexDirection: 'row' }}>{out}</View>;
}

function StoryPoster({ e, w, p, settled, radius = 3 }: { e: Entry; w: number; p: Palette; settled: (u: string) => void; radius?: number }) {
  return (
    <View style={{ width: w, height: w * 1.5, borderRadius: radius, overflow: 'hidden', backgroundColor: p.card }}>
      {e.posterUrl ? (
        <Image
          source={{ uri: e.posterUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoadEnd={() => settled(e.posterUrl as string)}
          onError={() => settled(e.posterUrl as string)}
        />
      ) : (
        <View style={styles.noPoster}>
          <Text style={[styles.noPosterText, { color: p.muted, fontSize: Math.max(8, w * 0.15) }]} numberOfLines={4}>
            {e.title.toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

function More({ n, w, p }: { n: number; w: number; p: Palette }) {
  return (
    <View style={[styles.more, { width: w, height: w * 1.5, borderColor: p.muted }]}>
      <Text style={[styles.moreText, { color: p.text, fontSize: Math.max(12, w * 0.3) }]}>+{n}</Text>
    </View>
  );
}

type LayoutProps = { p: Palette; entries: Entry[]; total: number; options: StoryOptions; area: number; settled: (u: string) => void };

/** Posters in the frames of a strip of film, sprocket holes above and below. */
function Strip({ p, entries, total, options, area, settled }: LayoutProps) {
  const { w, gap, label } = stripFit(total, options.ratings, area);
  const extra = total - entries.length;
  return (
    <View style={[styles.strip, { backgroundColor: p.strip }]}>
      <Holes color={p.bg[0]} count={16} />
      <View style={[styles.stripGrid, { gap }]}>
        {entries.map((e, i) => (
          <View key={e.id} style={{ width: w, alignItems: 'center' }}>
            <StoryPoster e={e} w={w} p={p} settled={settled} />
            {label > 0 && (
              <View style={styles.stripMeta}>
                {options.ranked && <Text style={[styles.rank, { color: p.accent }]}>{i + 1}</Text>}
                <StoryStars rating={e.rating} size={Math.min(9, w / 6.5)} color={p.star} />
                {e.liked && <Ionicons name="heart" size={Math.min(9, w / 6.5)} color={p.like} />}
              </View>
            )}
          </View>
        ))}
        {extra > 0 && <More n={extra} w={w} p={p} />}
      </View>
      <Holes color={p.bg[0]} count={16} />
    </View>
  );
}

/** One ticket stub per title: the day, the title, the stars. */
function Tickets({ p, entries, total, options, settled }: LayoutProps) {
  const extra = total - entries.length;
  return (
    <View style={{ gap: TICKET_GAP }}>
      {entries.map((e, i) => {
        const { day, month } = dayParts(e.watchedOn);
        return (
          <View key={e.id} style={[styles.ticket, { backgroundColor: p.card, borderColor: p.muted + '55' }]}>
            <View style={styles.ticketStub}>
              {options.ranked ? (
                <Text style={[styles.ticketDay, { color: p.accent }]}>{i + 1}</Text>
              ) : (
                <>
                  <Text style={[styles.ticketDay, { color: p.text }]}>{day}</Text>
                  <Text style={[styles.ticketMonth, { color: p.muted }]}>{month.toUpperCase()}</Text>
                </>
              )}
            </View>
            <View style={[styles.ticketTear, { borderColor: p.muted + '88' }]} />
            <StoryPoster e={e} w={20} p={p} settled={settled} radius={2} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.ticketTitle, { color: p.text }]} numberOfLines={1}>
                {e.title}
              </Text>
              <View style={styles.ticketMeta}>
                {options.ratings && <StoryStars rating={e.rating} size={10} color={p.star} />}
                {e.liked && <Ionicons name="heart" size={10} color={p.like} />}
                {e.rewatch && <Ionicons name="repeat" size={10} color={p.muted} />}
                {!!e.progress && (
                  <Text style={[styles.ticketProgress, { color: p.muted }]} numberOfLines={1}>
                    {e.progress}
                  </Text>
                )}
              </View>
            </View>
          </View>
        );
      })}
      {extra > 0 && <Text style={[styles.andMore, { color: p.muted }]}>+ {extra} MORE IN THE DIARY</Text>}
    </View>
  );
}

/** The favourite, big, with everything else in a row beneath. */
function Spotlight({ p, favourite, rest, total, options, settled }: Omit<LayoutProps, 'entries' | 'area'> & { favourite: Entry; rest: Entry[] }) {
  const extra = total - 1 - rest.length;
  const quote = favourite.review && !favourite.spoilers ? plainText(favourite.review).replace(/\s+/g, ' ').trim() : '';
  return (
    <View style={{ alignItems: 'center', gap: 7 }}>
      <Text style={[styles.kicker, { color: p.accent }]}>★ FAVOURITE ★</Text>
      <View style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}>
        <StoryPoster e={favourite} w={96} p={p} settled={settled} radius={6} />
      </View>
      <Text style={[styles.favTitle, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {favourite.title.toUpperCase()}
      </Text>
      <View style={styles.ticketMeta}>
        {options.ratings && <StoryStars rating={favourite.rating} size={16} color={p.star} />}
        {favourite.liked && <Ionicons name="heart" size={16} color={p.like} />}
      </View>
      {!!quote && (
        <Text style={[styles.quote, { color: p.text }]} numberOfLines={2}>
          “{quote.length > 100 ? `${quote.slice(0, 97)}…` : quote}”
        </Text>
      )}
      {rest.length > 0 && (
        <View style={styles.restRow}>
          {rest.map((e) => (
            <StoryPoster key={e.id} e={e} w={30} p={p} settled={settled} />
          ))}
          {extra > 0 && <More n={extra} w={30} p={p} />}
        </View>
      )}
    </View>
  );
}

function StatsBar({ p, stats }: { p: Palette; stats: ReturnType<typeof computeStats> }) {
  const hours = Math.round(stats.minutes / 60);
  const cells = [
    { value: hours ? `${hours}H` : '—', label: 'SCREEN TIME' },
    { value: stats.avgStars ? `${stats.avgStars}★` : '—', label: 'AVG RATING' },
    { value: stats.topGenre ? stats.topGenre.split(' ')[0].toUpperCase() : '—', label: 'TOP GENRE' },
  ];
  return (
    <View style={styles.statsWrap}>
      <View style={[styles.statsRow, { borderColor: p.muted + '55' }]}>
        {cells.map((c, i) => (
          <View key={c.label} style={[styles.statCell, i > 0 && { borderLeftWidth: 1, borderLeftColor: p.muted + '55' }]}>
            <Text style={[styles.statValue, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {c.value}
            </Text>
            <Text style={[styles.statLabel, { color: p.accent }]}>{c.label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.kinds, { color: p.muted }]}>{kindSummary(stats.byKind).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: STORY_W, height: STORY_H, overflow: 'hidden' },
  inner: { flex: 1, paddingTop: SAFE_TOP, paddingBottom: SAFE_BOTTOM - 24, paddingHorizontal: PAD, gap: 12 },
  // Clips anything too tall; spans the full width so the film strip can run edge to edge.
  middle: { flex: 1, justifyContent: 'center', overflow: 'hidden', marginHorizontal: -PAD, paddingHorizontal: PAD },
  masthead: { alignItems: 'center' },
  kicker: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 3 },
  title: { fontFamily: fonts.display, letterSpacing: 2, includeFontPadding: false, marginTop: 2 },
  subtitle: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 2 },
  holes: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  hole: { width: 9, height: 6, borderRadius: 1.5 },
  strip: { marginHorizontal: -PAD, paddingVertical: 6, gap: 8 },
  stripGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: PAD + 10 },
  stripMeta: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 12 },
  rank: { fontFamily: fonts.monoBold, fontSize: 8, marginRight: 1 },
  noPoster: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 3 },
  noPosterText: { fontFamily: fonts.display, textAlign: 'center' },
  more: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: fonts.display },
  ticket: { flexDirection: 'row', alignItems: 'center', gap: 8, height: TICKET_H, borderWidth: 1, borderRadius: 6, paddingRight: 8, overflow: 'hidden' },
  ticketStub: { width: 34, alignItems: 'center' },
  ticketDay: { fontFamily: fonts.display, fontSize: 22, lineHeight: 22, includeFontPadding: false },
  ticketMonth: { fontFamily: fonts.monoBold, fontSize: 7, letterSpacing: 1 },
  ticketTear: { alignSelf: 'stretch', borderLeftWidth: 1, borderStyle: 'dashed', marginLeft: -4 },
  ticketTitle: { fontSize: 12, fontWeight: '800' },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ticketProgress: { fontFamily: fonts.mono, fontSize: 8, flexShrink: 1 },
  andMore: { fontFamily: fonts.monoBold, fontSize: 9, lineHeight: MORE_H - TICKET_GAP, letterSpacing: 1.5, textAlign: 'center' },
  favTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, textAlign: 'center', letterSpacing: 1, includeFontPadding: false },
  quote: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, textAlign: 'center', fontStyle: 'italic', paddingHorizontal: 10 },
  restRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 2 },
  statsWrap: { gap: 6 },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 6 },
  statCell: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statValue: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26, includeFontPadding: false },
  statLabel: { fontFamily: fonts.monoBold, fontSize: 7, letterSpacing: 1.5 },
  kinds: { fontFamily: fonts.monoBold, fontSize: 8, letterSpacing: 1.5, textAlign: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  brandReel: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 2 },
});
