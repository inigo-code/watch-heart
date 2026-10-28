import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/**
 * A section's heading (REVIEW, WHERE TO WATCH, WATCHED WITH…): typewriter caps in the accent colour after
 * a short bar, so sections are easy to find at a glance. Every accent reads at 4.5:1 or better on its look.
 */
export function SectionLabel({ theme, children, style }: { theme: Theme; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]} accessibilityRole="header">
      <View style={[styles.bar, { backgroundColor: theme.accent }]} />
      <Text style={[styles.text, { color: theme.accent }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { width: 3, height: 15, borderRadius: 2 },
  text: { flexShrink: 1, fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.5, textTransform: 'uppercase' },
});
