import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Text } from '@/components/AppText';
import { Poster } from '@/components/Film';
import { Rise, Tap } from '@/components/Motion';
import { SectionLabel } from '@/components/SectionLabel';
import { isoDate, monthKey, parseIso, today } from '@/lib/dates';
import { computeStats } from '@/lib/stats';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { Entry } from '@/store/types';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const GAP = 6;

/** Monday to Sunday of the week holding this day. */
function weekOf(day: string) {
  const d = parseIso(day);
  const monday = d.getDate() - ((d.getDay() + 6) % 7);
  return LETTERS.map((_, i) => isoDate(new Date(d.getFullYear(), d.getMonth(), monday + i)));
}

/**
 * The top of Home: your week, one tile a day, with the poster of what you watched. A glance at your own
 * viewing, then the one thing this app is for: logging what you watched.
 */
export function WeekStrip({ entries, theme }: { entries: Entry[]; theme: Theme }) {
  const { width } = useWindowDimensions();
  const now = today();
  const tile = (width - 32 - GAP * 6) / 7;
  const month = entries.filter((e) => !e.undated && monthKey(e.watchedOn) === monthKey(now));
  const hours = Math.round(computeStats(month).minutes / 60);
  return (
    <Rise style={styles.wrap}>
      <View style={styles.head}>
        <SectionLabel theme={theme}>This week</SectionLabel>
        {month.length > 0 && (
          <Tap onPress={() => router.navigate('/diary')} accessibilityRole="button" accessibilityLabel="Open your diary">
            <Text style={[styles.month, { color: theme.textMuted }]}>
              {month.length} this month{hours ? ` · ${hours}h` : ''}
            </Text>
          </Tap>
        )}
      </View>
      <View style={styles.week}>
        {weekOf(now).map((day, i) => {
          const that = entries.filter((e) => !e.undated && e.watchedOn === day);
          const shown = that.find((e) => e.posterUrl) ?? that[0];
          const isToday = day === now;
          const future = day > now;
          return (
            <Tap
              key={day}
              disabled={future || (!shown && !isToday)}
              onPress={() => (shown ? router.push({ pathname: '/entry/[id]', params: { id: shown.id } }) : router.navigate('/search'))}
              scale={0.94}
              accessibilityRole="button"
              accessibilityLabel={shown ? `${day}: ${shown.title}` : isToday ? 'Today: log what you watched' : day}
              style={{ width: tile }}
            >
              <Text style={[styles.letter, { color: isToday ? theme.accent : theme.textMuted }]}>{LETTERS[i]}</Text>
              <View style={[styles.day, { width: tile, height: tile * 1.5, backgroundColor: theme.card, borderColor: isToday ? theme.accent : theme.border, opacity: future ? 0.45 : 1 }]}>
                {shown ? (
                  <Poster uri={shown.posterUrl} title={shown.title} width={tile} theme={theme} radius={5} />
                ) : isToday ? (
                  <Ionicons name="add" size={20} color={theme.accent} />
                ) : (
                  <Text style={[styles.date, { color: theme.textMuted }]}>{Number(day.slice(8))}</Text>
                )}
                {that.length > 1 && (
                  <View style={[styles.more, { backgroundColor: theme.accent }]}>
                    <Text style={[styles.moreText, { color: theme.accentText }]}>{that.length}</Text>
                  </View>
                )}
              </View>
            </Tap>
          );
        })}
      </View>
      <Tap onPress={() => router.navigate('/search')} accessibilityRole="button" style={[styles.log, { backgroundColor: theme.accent }]}>
        <Ionicons name="add" size={22} color={theme.accentText} />
        <Text style={[styles.logText, { color: theme.accentText }]}>LOG WHAT YOU WATCHED</Text>
      </Tap>
    </Rise>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: font.footnote, fontWeight: '600' },
  week: { flexDirection: 'row', gap: GAP },
  letter: { fontFamily: fonts.monoBold, fontSize: font.caption, textAlign: 'center', marginBottom: 4 },
  day: { borderWidth: 1, borderRadius: 6, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  date: { fontFamily: fonts.display, fontSize: 20 },
  more: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  moreText: { fontFamily: fonts.monoBold, fontSize: 12, lineHeight: 15 },
  log: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26, marginTop: 4 },
  logText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
});
