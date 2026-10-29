import { StyleSheet, Text, View } from 'react-native';

import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/**
 * How you rate: one bar per half star, with how many you gave above it, your average, and the rating you
 * give most picked out. `ratings` counts each half-star rating at index 1–10 (index 0 is unrated).
 */
export function RatingChart({ ratings, theme, height = 72 }: { ratings: number[]; theme: Theme; height?: number }) {
  const bars = ratings.slice(1);
  const rated = bars.reduce((a, n) => a + n, 0);
  const max = Math.max(1, ...bars);
  const most = rated ? bars.indexOf(Math.max(...bars)) : -1;
  const avg = rated ? bars.reduce((a, n, i) => a + n * (i + 1), 0) / rated / 2 : 0;

  if (!rated) return <Text style={[styles.empty, { color: theme.textMuted }]}>Rate a few titles to see how you rate.</Text>;

  return (
    <View style={styles.wrap}>
      <View style={styles.summary}>
        <Text style={[styles.avg, { color: theme.text }]}>
          {avg.toFixed(1)}
          <Text style={{ color: theme.star }}>★</Text>
        </Text>
        <Text style={[styles.summaryText, { color: theme.textMuted }]}>
          average of {rated} {rated === 1 ? 'rating' : 'ratings'}
          {'\n'}most often {stars(most + 1)}
        </Text>
      </View>
      <View
        style={[styles.bars, { height: height + 18 }]}
        accessible
        accessibilityLabel={bars.map((n, i) => (n ? `${stars(i + 1)}: ${n}` : null)).filter(Boolean).join(', ')}
      >
        {bars.map((n, i) => (
          <View key={i} style={styles.col}>
            {n > 0 && <Text style={[styles.count, { color: i === most ? theme.text : theme.textMuted }]}>{n}</Text>}
            <View style={[styles.bar, { height: 3 + (n / max) * height, backgroundColor: n ? theme.star : theme.elevated, opacity: n && i !== most ? 0.5 : 1 }]} />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {bars.map((_, i) => (
          <Text key={i} style={[styles.label, { color: theme.textMuted }]}>
            {(i + 1) % 2 === 0 ? (i + 1) / 2 : i === 0 ? '½' : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** 7 → "3½★" */
const stars = (half: number) => `${Math.floor(half / 2) || ''}${half % 2 ? '½' : ''}★`;

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  empty: { fontFamily: fonts.mono, fontSize: font.footnote },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  avg: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, includeFontPadding: false },
  summaryText: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  count: { fontFamily: fonts.monoBold, fontSize: 10 },
  bar: { width: '100%', borderRadius: 3 },
  labels: { flexDirection: 'row', gap: 4 },
  label: { flex: 1, textAlign: 'center', fontFamily: fonts.mono, fontSize: 10 },
});
