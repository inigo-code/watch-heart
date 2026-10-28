import { useRef } from 'react';
import type { ComponentRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MONTHS } from '@/lib/dates';
import type { ProfileStats } from '@/lib/profileStats';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

const CELL = 12;
const GAP = 3;
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

/** A year of viewings, one square a day, darker for busier days; scrolls back from this week. */
export function ActivityGraph({ weeks, theme }: { weeks: ProfileStats['weeks']; theme: Theme }) {
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const shade = (n: number) => (n === 0 ? theme.elevated : n === 1 ? theme.accent + '5C' : n === 2 ? theme.accent + 'A6' : theme.accent);

  return (
    <View style={styles.wrap}>
      <View style={styles.days}>
        {DAY_LABELS.map((d, i) => (
          <Text key={i} style={[styles.dayLabel, { color: theme.textMuted }]}>
            {d}
          </Text>
        ))}
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        <View>
          <View style={styles.months}>
            {weeks.map((w, i) => {
              const month = Number(w[0].date.slice(5, 7)) - 1;
              const starts = i === 0 || w[0].date.slice(5, 7) !== weeks[i - 1][0].date.slice(5, 7);
              return (
                <Text key={w[0].date} style={[styles.monthLabel, { color: theme.textMuted }]} numberOfLines={1}>
                  {starts && i < weeks.length - 1 ? MONTHS[month].slice(0, 3) : ''}
                </Text>
              );
            })}
          </View>
          <View style={styles.grid}>
            {weeks.map((w) => (
              <View key={w[0].date} style={styles.week}>
                {w.map((d) => (
                  <View
                    key={d.date}
                    accessibilityLabel={d.count ? `${d.date}: ${d.count} logged` : undefined}
                    style={[styles.cell, { backgroundColor: d.future ? 'transparent' : shade(d.count) }]}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** The key under the graph: less to more. */
export function ActivityKey({ theme }: { theme: Theme }) {
  return (
    <View style={styles.key}>
      <Text style={[styles.keyText, { color: theme.textMuted }]}>LESS</Text>
      {[theme.elevated, theme.accent + '5C', theme.accent + 'A6', theme.accent].map((c) => (
        <View key={c} style={[styles.cell, { backgroundColor: c }]} />
      ))}
      <Text style={[styles.keyText, { color: theme.textMuted }]}>MORE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 6 },
  days: { paddingTop: 16, gap: GAP },
  dayLabel: { height: CELL, fontFamily: fonts.mono, fontSize: 9, lineHeight: CELL },
  months: { flexDirection: 'row', gap: GAP, height: 14 },
  monthLabel: { width: CELL, fontFamily: fonts.mono, fontSize: 9, overflow: 'visible' },
  grid: { flexDirection: 'row', gap: GAP, marginTop: 2 },
  week: { gap: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3 },
  key: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  keyText: { fontFamily: fonts.mono, fontSize: font.caption - 2, letterSpacing: 1 },
});
