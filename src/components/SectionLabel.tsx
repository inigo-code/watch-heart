import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/AppText';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/**
 * A section's heading (Review, Where to watch, Up next…): sentence case in the text colour, a step above
 * body text and semibold, so sections are easy to find without shouting. The accent is kept for actions.
 */
export function SectionLabel({ theme, children, style }: { theme: Theme; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]} accessibilityRole="header">
      <Text style={[styles.text, { color: theme.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flexShrink: 1, fontFamily: fonts.uiSemibold, fontSize: font.headline, lineHeight: 22 },
});
