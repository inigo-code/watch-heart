import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Text } from '@/components/AppText';
import { CineIcon } from '@/components/CineIcon';
import { Poster, Sprockets, Stars } from '@/components/Film';
import { Rise, Tap } from '@/components/Motion';
import { SectionLabel } from '@/components/SectionLabel';
import { dayParts, friendlyDate, isoDate, monthKey, parseIso, today } from '@/lib/dates';
import { easeNextLayout } from '@/lib/motion';
import { computeStats } from '@/lib/stats';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { Entry } from '@/store/types';

const GAP = 5;
// The strip's own margin inside its edges, either side of the frames.
const INSET = 8;
// The day names and empty frames on the strip, which is always dark.
const ON_STRIP = 'rgba(244,239,230,0.6)';
const EMPTY_FRAME = 'rgba(244,239,230,0.07)';
const TRAY = 72;

/** Monday to Sunday of the week holding this day. */
function weekOf(day: string) {
  const d = parseIso(day);
  const monday = d.getDate() - ((d.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => isoDate(new Date(d.getFullYear(), d.getMonth(), monday + i)));
}

/**
 * The top of Home: your week as a strip of film, one frame a day with the poster of what you watched and
 * today's frame lit, like a month in the Diary. A glance at your own viewing, then the one thing this app
 * is for: logging what you watched.
 */
export function WeekStrip({ entries, theme }: { entries: Entry[]; theme: Theme }) {
  const { width } = useWindowDimensions();
  const now = today();
  const tile = (width - 32 - INSET * 2 - GAP * 6) / 7;
  const month = entries.filter((e) => !e.undated && monthKey(e.watchedOn) === monthKey(now));
  const stats = computeStats(month);
  const hours = Math.round(stats.minutes / 60);
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (day: string) => {
    easeNextLayout();
    setOpen(open === day ? null : day);
  };
  const tray = open ? entries.filter((e) => !e.undated && e.watchedOn === open) : [];
  return (
    <Rise style={styles.wrap}>
      <View style={styles.head}>
        <SectionLabel theme={theme}>This week</SectionLabel>
        {month.length > 0 && (
          <Tap onPress={() => router.navigate('/diary')} accessibilityRole="button" accessibilityLabel="Open your diary">
            <Text style={[styles.month, { color: theme.textMuted }]}>
              {stats.total} this month{hours ? ` · ${hours}h` : ''}
            </Text>
          </Tap>
        )}
      </View>
      <View style={[styles.strip, { backgroundColor: theme.dark ? '#000000' : theme.text }]}>
        <Sprockets color={theme.dark ? theme.border : theme.bg} count={16} hole={5} />
        <View style={styles.week}>
          {weekOf(now).map((day) => {
            const that = entries.filter((e) => !e.undated && e.watchedOn === day);
            const shown = that.find((e) => e.posterUrl) ?? that[0];
            const isToday = day === now;
            const future = day > now;
            const lit = open === day || isToday;
            return (
              <Tap
                key={day}
                disabled={future || (!shown && !isToday)}
                onPress={() => (that.length > 1 ? toggle(day) : shown ? router.push({ pathname: '/entry/[id]', params: { id: shown.id } }) : router.navigate('/search'))}
                scale={0.94}
                accessibilityRole="button"
                accessibilityLabel={that.length > 1 ? `${friendlyDate(day)}: ${that.length} titles` : shown ? `${friendlyDate(day)}: ${shown.title}` : isToday ? 'Today: log what you watched' : friendlyDate(day)}
                accessibilityState={that.length > 1 ? { expanded: open === day } : undefined}
                style={{ width: tile, opacity: future ? 0.4 : 1 }}
              >
                {/* Printed on the film's edge, like the reel's lettering in the Diary. */}
                <Text numberOfLines={1} maxFontSizeMultiplier={1.1} style={[styles.dayName, { color: isToday ? theme.accentOnDark : ON_STRIP }]}>
                  {dayParts(day).weekday.toUpperCase()}
                </Text>
                <View style={[styles.frame, { width: tile, height: tile * 1.5, backgroundColor: EMPTY_FRAME, borderColor: lit ? theme.accentOnDark : 'transparent' }]}>
                  {shown ? (
                    <Poster uri={shown.posterUrl} title={shown.title} width={tile - 3} theme={theme} radius={2} />
                  ) : isToday ? (
                    <Ionicons name="add" size={20} color={theme.accentOnDark} />
                  ) : null}
                  {that.length > 1 && (
                    <View style={[styles.more, { backgroundColor: theme.accentOnDark }]}>
                      <Text style={[styles.moreText, { color: '#141210' }]}>{that.length}</Text>
                    </View>
                  )}
                </View>
              </Tap>
            );
          })}
        </View>
        <Sprockets color={theme.dark ? theme.border : theme.bg} count={16} hole={5} />
      </View>
      {open && tray.length > 1 && (
        <View style={[styles.tray, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.trayHead}>
            <Text style={[styles.trayDay, { color: theme.text }]}>{friendlyDate(open)}</Text>
            <Tap onPress={() => toggle(open)} hitSlop={12} scale={0.9} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="chevron-up" size={20} color={theme.textMuted} />
            </Tap>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayRow}>
            {tray.map((e, n) => (
              <Rise key={e.id} order={n}>
                <Tap onPress={() => router.push({ pathname: '/entry/[id]', params: { id: e.id } })} accessibilityRole="button" accessibilityLabel={e.title} style={styles.trayItem}>
                  <Poster uri={e.posterUrl} title={e.title} width={TRAY} theme={theme} radius={6} />
                  <Text style={[styles.trayTitle, { color: theme.text }]} numberOfLines={1}>
                    {e.title}
                  </Text>
                  {e.rating ? <Stars rating={e.rating} size={11} color={theme.star} /> : null}
                </Tap>
              </Rise>
            ))}
          </ScrollView>
        </View>
      )}
      <Tap onPress={() => router.navigate('/search')} accessibilityRole="button" style={[styles.log, { backgroundColor: theme.accent }]}>
        <CineIcon name="log" size={22} color={theme.accentText} />
        <Text style={[styles.logText, { color: theme.accentText }]}>Log what you watched</Text>
      </Tap>
    </Rise>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: font.footnote, fontWeight: '600' },
  strip: { borderRadius: 4, paddingVertical: 6, gap: 6 },
  week: { flexDirection: 'row', gap: GAP, paddingHorizontal: INSET },
  dayName: { fontFamily: fonts.ticketBold, fontSize: 10, letterSpacing: 1, textAlign: 'center', marginBottom: 4 },
  tray: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  trayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trayDay: { fontSize: font.footnote, fontWeight: '700' },
  trayRow: { gap: 12, paddingRight: 4 },
  trayItem: { width: TRAY, gap: 4 },
  trayTitle: { fontSize: font.caption, fontWeight: '600' },
  frame: { borderWidth: 1.5, borderRadius: 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  more: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  moreText: { fontFamily: fonts.uiSemibold, fontSize: 12, lineHeight: 15 },
  log: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, marginTop: 4 },
  logText: { fontFamily: fonts.uiSemibold, fontSize: font.footnote },
});
