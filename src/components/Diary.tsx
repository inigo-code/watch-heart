import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Poster, KindBadge, Sprockets, Stars } from '@/components/Film';
import { dayParts, monthName } from '@/lib/dates';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { Entry } from '@/store/types';

const NOTCH = 14;

/**
 * One diary entry as a cinema ticket: a stub with the date, a perforated tear line with notches cut
 * out of the edges, then the poster and what you thought of it.
 */
export function TicketStub({ entry, theme, onPress, onLongPress }: {
  entry: Entry;
  theme: Theme;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { day, weekday } = dayParts(entry.watchedOn);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, watched ${weekday} ${day}${entry.rating ? `, ${entry.rating / 2} stars` : ''}`}
      style={({ pressed }) => [styles.ticket, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.stub}>
        <Text style={[styles.weekday, { color: theme.textMuted }]}>{entry.undated ? 'DATE' : weekday.toUpperCase()}</Text>
        <Text style={[styles.day, { color: theme.text }]}>{entry.undated ? '?' : day}</Text>
        {entry.rewatch && <Ionicons name="repeat" size={14} color={theme.accent} accessibilityLabel="Rewatch" />}
      </View>

      <View style={styles.tear}>
        <View style={[styles.notch, styles.notchTop, { backgroundColor: theme.hole, borderColor: theme.border }]} />
        <View style={[styles.dashes, { borderColor: theme.border }]} />
        <View style={[styles.notch, styles.notchBottom, { backgroundColor: theme.hole, borderColor: theme.border }]} />
      </View>

      <Poster uri={entry.posterUrl} title={entry.title} width={54} theme={theme} radius={4} />

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
          <Text style={[styles.reelMonth, { color: theme.dark ? theme.text : theme.bg }]}>{archive ? 'THE ARCHIVE' : monthName(month).toUpperCase()}</Text>
          <Text style={[styles.reelMeta, { color: theme.accent }]}>
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
            style={({ pressed }) => [styles.reelShare, { borderColor: theme.accent, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="sparkles" size={14} color={theme.accent} />
            <Text style={[styles.reelShareText, { color: theme.accent }]}>STORY</Text>
          </Pressable>
        )}
      </View>
      <Sprockets color={theme.bg} count={16} hole={6} />
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingRight: 12, gap: 10, overflow: 'hidden' },
  stub: { width: 54, alignItems: 'center', gap: 0 },
  weekday: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1 },
  day: { fontFamily: fonts.display, fontSize: 36, lineHeight: 38, includeFontPadding: false },
  tear: { alignSelf: 'stretch', width: NOTCH, alignItems: 'center', marginVertical: -10, marginLeft: -6 },
  dashes: { flex: 1, borderLeftWidth: 1.5, borderStyle: 'dashed' },
  notch: { width: NOTCH, height: NOTCH / 2, borderWidth: StyleSheet.hairlineWidth },
  notchTop: { borderBottomLeftRadius: NOTCH, borderBottomRightRadius: NOTCH, borderTopWidth: 0 },
  notchBottom: { borderTopLeftRadius: NOTCH, borderTopRightRadius: NOTCH, borderBottomWidth: 0 },
  body: { flex: 1, gap: 5 },
  title: { fontSize: font.headline, fontWeight: '700', lineHeight: 21 },
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
