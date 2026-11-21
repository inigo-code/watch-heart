import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme';

const HEADER = 64;

/**
 * What every page stands on: the theme's flat ground, and room for the header above the content. `floating`
 * pages run up under the header themselves.
 */
export function PageGround({ floating, children }: { floating?: boolean; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { backgroundColor: theme.bg }]}>
      <View style={[styles.page, !floating && { paddingTop: insets.top + HEADER }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
});
