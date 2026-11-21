import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Poster } from '@/components/Film';
import { Tap } from '@/components/Motion';
import { rail } from '@/components/title/Rows';
import { dayParts } from '@/lib/dates';
import { busiestDay, oneEach } from '@/lib/stats';
import { fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { Entry } from '@/store/types';

const FRAME = 64;
const GAP = 8;
const ON_STRIP = 'rgba(244,239,230,0.6)';

/**
 * The month (or year) as a reel of film: each title once, in the order you watched it, with the day printed on
 * the strip's edge like a film's edge code. The busiest day's frames are lit. A frame opens its entry.
 */
export function RecapReel({ entries, theme }: { entries: Entry[]; theme: Theme }) {
  const frames = useMemo(
    () => [...oneEach(entries)].sort((a, b) => a.watchedOn.localeCompare(b.watchedOn) || a.createdAt - b.createdAt),
    [entries],
  );
  const busiest = useMemo(() => busiestDay(entries), [entries]);
  const holes = theme.dark ? theme.border : theme.bg;
  const busiestWords = busiest ? (({ weekday, day, month }) => `${weekday} ${day} ${month}`)(dayParts(busiest.day)) : '';

  return (
    <View style={styles.wrap}>
      <FlatList
        horizontal
        data={frames}
        keyExtractor={(e) => e.id}
        showsHorizontalScrollIndicator={false}
        style={[rail.edge, { backgroundColor: theme.dark ? '#000000' : theme.text }]}
        contentContainerStyle={styles.row}
        initialNumToRender={8}
        windowSize={5}
        getItemLayout={(_, i) => ({ length: FRAME + GAP, offset: 16 + (FRAME + GAP) * i, index: i })}
        renderItem={({ item: e }) => {
          const { weekday, day, month } = dayParts(e.watchedOn);
          const lit = busiest?.day === e.watchedOn;
          return (
            <View style={styles.cell}>
              <Holes color={holes} />
              <Tap
                onPress={() => router.push({ pathname: '/entry/[id]', params: { id: e.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${e.title}, ${weekday} ${day} ${month}`}
                style={[styles.frame, { borderColor: lit ? theme.accentOnDark : 'transparent' }]}
              >
                <Poster uri={e.posterUrl} title={e.title} width={FRAME - 3} theme={theme} radius={2} />
              </Tap>
              <Text style={[styles.code, { color: lit ? theme.accentOnDark : ON_STRIP }]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                {`${day} ${month.toUpperCase()}`}
              </Text>
              <Holes color={holes} />
            </View>
          );
        }}
      />
      <Text style={[styles.caption, { color: theme.textMuted }]}>
        {busiest ? `Busiest day ${busiestWords}, with ${busiest.count} viewings. ` : ''}
        {frames.length === 1 ? 'One title' : `${frames.length} titles`}, in the order you watched them.
      </Text>
    </View>
  );
}

/** A frame's share of the strip's perforation, so the holes scroll with the film. */
function Holes({ color }: { color: string }) {
  return (
    <View style={styles.holes} pointerEvents="none">
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.hole, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { paddingHorizontal: 16, gap: GAP },
  cell: { width: FRAME, paddingVertical: 5, gap: 5, alignItems: 'center' },
  frame: { borderWidth: 1.5, borderRadius: 3, overflow: 'hidden' },
  code: { fontFamily: fonts.ticketBold, fontSize: 10, letterSpacing: 0.5 },
  holes: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch' },
  hole: { width: 7, height: 5, borderRadius: 1.5 },
  caption: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18 },
});
