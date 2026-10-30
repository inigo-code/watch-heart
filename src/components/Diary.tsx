import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Poster, KindBadge, Sprockets, Stars } from '@/components/Film';
import { dayParts, monthName } from '@/lib/dates';
import { KIND_COLORS, font, fonts, kindColor } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { Entry, MediaKind } from '@/store/types';

const NOTCH = 14;
const PAPER_PRINT = require('../../assets/ticket-paper.png');

/** Mixes `b` into `a` (both #RRGGBB) by `t`. */
function mix(a: string, b: string, t: number) {
  const c = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(c(a, i) + (c(b, i) - c(a, i)) * t).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Ticket paper, coloured by class as old Indian cinema tickets were: films on gold, series on teal, anime
 * on pink, faint enough that the card still reads as the app's own. `ink` prints the serial and the
 * engraving.
 */
export function ticketPaper(kind: MediaKind, theme: Theme) {
  return {
    paper: mix(theme.card, KIND_COLORS[kind], theme.dark ? 0.075 : 0.16),
    border: mix(theme.border, KIND_COLORS[kind], theme.dark ? 0.18 : 0.3),
    ink: kindColor(kind, theme),
    print: theme.dark ? 0.09 : 0.14,
  };
}

/** The engraved security print behind a ticket. Sits first inside the ticket, which clips it. */
export function TicketPrint({ kind, theme }: { kind: MediaKind; theme: Theme }) {
  const p = ticketPaper(kind, theme);
  return <Image source={PAPER_PRINT} style={[StyleSheet.absoluteFill, { opacity: p.print, tintColor: p.ink, width: '100%', height: '100%' }]} resizeMode="cover" pointerEvents="none" />;
}

/**
 * One diary entry as an Indian cinema ticket: paper tinted by kind with an engraved print, a stub with the
 * date, a perforated tear line with notches cut out of the edges, then the poster and what you thought of it.
 * Compact, so a month fits on a screen or two.
 */
export function TicketStub({ entry, theme, onPress, onLongPress }: {
  entry: Entry;
  theme: Theme;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { day, weekday } = dayParts(entry.watchedOn);
  const p = ticketPaper(entry.kind, theme);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, watched ${weekday} ${day}${entry.rating ? `, ${entry.rating / 2} stars` : ''}`}
      style={({ pressed }) => [styles.ticket, { backgroundColor: p.paper, borderColor: p.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <TicketPrint kind={entry.kind} theme={theme} />
      <View style={styles.stub}>
        <Text style={[styles.weekday, { color: theme.textMuted }]}>{entry.undated ? 'DATE' : weekday.toUpperCase()}</Text>
        <Text style={[styles.day, { color: theme.text }]}>{entry.undated ? '?' : day}</Text>
        {entry.rewatch && <Ionicons name="repeat" size={14} color={theme.accent} accessibilityLabel="Rewatch" />}
      </View>

      <View style={styles.tear}>
        <View style={[styles.notch, styles.notchTop, { backgroundColor: theme.hole, borderColor: p.border }]} />
        <View style={[styles.dashes, { borderColor: p.border }]} />
        <View style={[styles.notch, styles.notchBottom, { backgroundColor: theme.hole, borderColor: p.border }]} />
      </View>

      <Poster uri={entry.posterUrl} title={entry.title} width={40} theme={theme} radius={3} />

      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {entry.title}
          {entry.year ? <Text style={[styles.year, { color: theme.textMuted }]}>{`  ${entry.year}`}</Text> : null}
        </Text>
        <View style={styles.meta}>
          <KindBadge kind={entry.kind} theme={theme} small />
          {!!entry.progress && (
            <Text style={[styles.progress, { color: theme.textMuted }]} numberOfLines={1}>
              {entry.progress}
            </Text>
          )}
        </View>
        <View style={styles.meta}>
          <Stars rating={entry.rating} size={13} color={theme.star} />
          {entry.liked && <Ionicons name="heart" size={13} color={theme.like} accessibilityLabel="Liked" />}
          {!!entry.review.trim() && <Ionicons name="reader-outline" size={13} color={theme.textMuted} accessibilityLabel="Has a review" />}
        </View>
      </View>
    </Pressable>
  );
}

/** A poster on the wall (grid layout), with stars and a heart under it. */
export function PosterTile({ entry, theme, width, onPress }: { entry: Entry; theme: Theme; width: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={entry.title} style={({ pressed }) => [{ width, opacity: pressed ? 0.8 : 1 }]}>
      <Poster uri={entry.posterUrl} title={entry.title} width={width} theme={theme} radius={5} />
      <View style={styles.tileMeta}>
        <Stars rating={entry.rating} size={10} color={theme.star} />
        {entry.liked && <Ionicons name="heart" size={10} color={theme.like} />}
        {entry.rewatch && <Ionicons name="repeat" size={10} color={theme.textMuted} />}
      </View>
    </Pressable>
  );
}

/**
 * A month in the diary: a strip of film with the month in marquee letters, the reel number and the count.
 * month "archive" is the reel of imports without a watch date.
 */
export function ReelHeader({ month, count, theme, onShare }: { month: string; count: number; theme: Theme; onShare: () => void }) {
  const archive = month === 'archive';
  const reel = Number(month.slice(5, 7));
  return (
    <View style={[styles.reel, { backgroundColor: theme.dark ? '#000000' : theme.text }]}>
      <Sprockets color={theme.bg} count={16} hole={6} />
      <View style={styles.reelRow}>
        <View style={{ flex: 1 }}>
          <Text maxFontSizeMultiplier={1.15} style={[styles.reelMonth, { color: theme.dark ? theme.text : theme.bg }]}>{archive ? 'THE ARCHIVE' : monthName(month).toUpperCase()}</Text>
          <Text style={[styles.reelMeta, { color: theme.accentOnDark }]}>
            {archive
              ? `NO WATCH DATE · ${count} ${count === 1 ? 'TITLE' : 'TITLES'}`
              : `${month.slice(0, 4)} · REEL ${String(reel).padStart(2, '0')} · ${count} ${count === 1 ? 'TITLE' : 'TITLES'}`}
          </Text>
        </View>
        {!archive && (
          <Pressable
            onPress={onShare}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Make a story for ${monthName(month)}`}
            style={({ pressed }) => [styles.reelShare, { borderColor: theme.accentOnDark, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="sparkles" size={14} color={theme.accentOnDark} />
            <Text style={[styles.reelShareText, { color: theme.accentOnDark }]}>STORY</Text>
          </Pressable>
        )}
      </View>
      <Sprockets color={theme.bg} count={16} hole={6} />
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 7, paddingRight: 12, gap: 10, overflow: 'hidden' },
  stub: { width: 48, alignItems: 'center', gap: 0 },
  weekday: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1 },
  day: { fontFamily: fonts.display, fontSize: 30, lineHeight: 31, includeFontPadding: false },
  tear: { alignSelf: 'stretch', width: NOTCH, alignItems: 'center', marginVertical: -7, marginLeft: -6 },
  dashes: { flex: 1, borderLeftWidth: 1.5, borderStyle: 'dashed' },
  notch: { width: NOTCH, height: NOTCH / 2, borderWidth: StyleSheet.hairlineWidth },
  notchTop: { borderBottomLeftRadius: NOTCH, borderBottomRightRadius: NOTCH, borderTopWidth: 0 },
  notchBottom: { borderTopLeftRadius: NOTCH, borderTopRightRadius: NOTCH, borderBottomWidth: 0 },
  body: { flex: 1, gap: 3 },
  title: { fontSize: font.body, fontWeight: '700', lineHeight: 19 },
  year: { fontFamily: fonts.mono, fontSize: font.footnote, fontWeight: '400' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progress: { fontFamily: fonts.mono, fontSize: font.caption, flexShrink: 1 },
  tileMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 16, marginTop: 3 },
  reel: { paddingVertical: 6, gap: 8, borderRadius: 4, marginTop: 14 },
  reelRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  reelMonth: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, letterSpacing: 2, includeFontPadding: false },
  reelMeta: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.2 },
  reelShare: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 14, height: 28, paddingHorizontal: 10 },
  reelShareText: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1 },
});
