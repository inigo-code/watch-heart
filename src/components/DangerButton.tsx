import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/** A button for something that removes or resets: outlined in red, with an icon, and always confirmed after. */
export function DangerButton({ theme, label, icon = 'trash-outline', onPress, busy, style }: {
  theme: Theme;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      style={({ pressed }) => [styles.btn, { borderColor: theme.danger, backgroundColor: pressed ? theme.danger + '1F' : 'transparent' }, style]}
    >
      {busy ? <ActivityIndicator color={theme.danger} /> : <Ionicons name={icon} size={18} color={theme.danger} />}
      <Text style={[styles.text, { color: theme.danger }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 24, borderWidth: 1.5, paddingHorizontal: 18 },
  text: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.5 },
});
