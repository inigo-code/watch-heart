import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/**
 * One quiet line where saved data (your lists, your profile) couldn't be read from the phone. Nothing is
 * saved or synced over it meanwhile, and coming back to the app tries again.
 */
export function UnreadNote({ theme, what }: { theme: Theme; what: string }) {
  return (
    <View style={[styles.note, { borderColor: theme.border }]} accessibilityRole="text" accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={18} color={theme.textMuted} />
      <Text style={[styles.text, { color: theme.textMuted }]}>
        {`Couldn’t open your ${what} just now. Nothing has been deleted. Leave Watch Heart and come back to try again.`}
      </Text>
    </View>
  );
}

// The same look as Home's offline line.
const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  text: { flex: 1, fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17 },
});
