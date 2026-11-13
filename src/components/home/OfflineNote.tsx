import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/** One quiet line on Home when none of its rows could load: no connection, most likely. */
export function OfflineNote({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.note, { borderColor: theme.border }]} accessibilityRole="text" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={18} color={theme.textMuted} />
      <Text style={[styles.text, { color: theme.textMuted }]}>
        You seem to be offline. Your diary and watchlist still work. Pull down to try again.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  text: { flex: 1, fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17 },
});
