import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/** A heart on a film reel: the app's mark. */
export function HeartMark({ theme, size = 34 }: { theme: Theme; size?: number }) {
  return (
    <View
      style={[styles.reel, { width: size, height: size, borderRadius: size / 2, borderColor: theme.accent, borderWidth: Math.max(2, size / 14) }]}
      accessible={false}
    >
      <Ionicons name="heart" size={size * 0.52} color={theme.accent} />
    </View>
  );
}

/** "WATCH HEART" in the marquee face, with the reel mark between the words. */
export function BrandTitle({ theme, size = 40 }: { theme: Theme; size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Watch Heart">
      <Text style={[styles.word, { color: theme.text, fontSize: size, lineHeight: size * 1.05 }]}>WATCH</Text>
      <HeartMark theme={theme} size={size * 0.68} />
      <Text style={[styles.word, { color: theme.accent, fontSize: size, lineHeight: size * 1.05 }]}>HEART</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  word: { fontFamily: fonts.display, letterSpacing: 1.5, includeFontPadding: false },
  reel: { alignItems: 'center', justifyContent: 'center' },
});
