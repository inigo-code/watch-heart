import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { TIER_COLORS } from '@/lib/profileStats';
import type { Achievement } from '@/lib/profileStats';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/** Badges in two columns: unlocked ones in their tier's metal, locked ones with progress to the first tier. */
export function Achievements({ list, theme }: { list: Achievement[]; theme: Theme }) {
  return (
    <View style={styles.grid}>
      {list.map((a) => {
        const metal = a.tier ? TIER_COLORS[a.tier] : theme.border;
        const done = a.tier === 'platinum';
        return (
          <View key={a.id} style={[styles.badge, { backgroundColor: theme.card, borderColor: a.tier ? metal : theme.border }]}>
            <View style={styles.top}>
              <View style={[styles.medal, { borderColor: metal, backgroundColor: a.tier ? metal + '26' : 'transparent' }]}>
                <Ionicons name={(a.tier ? a.icon : 'lock-closed') as keyof typeof Ionicons.glyphMap} size={18} color={a.tier ? metal : theme.textMuted} />
              </View>
              {a.tier && <Text style={[styles.tier, { color: metal }]}>{a.tier.toUpperCase()}</Text>}
            </View>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {a.name}
            </Text>
            <Text style={[styles.goal, { color: theme.textMuted }]} numberOfLines={2}>
              {done ? 'Every tier unlocked' : a.goal}
            </Text>
            {!done && (
              <View style={[styles.track, { backgroundColor: theme.elevated }]}>
                <View style={[styles.fill, { width: `${Math.round((a.progress / a.next) * 100)}%`, backgroundColor: a.tier ? metal : theme.accent }]} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: { width: '48.4%', borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  medal: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tier: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1.5 },
  name: { fontFamily: fonts.display, fontSize: font.title, letterSpacing: 0.5 },
  goal: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 15, minHeight: 30 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 3 },
});
