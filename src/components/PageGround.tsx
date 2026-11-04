import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

const HEADER = 64;

/** A soft wash of the accent at the top of the page, fading into it, like light from the screen in a dark hall. */
function Glow({ theme }: { theme: Theme }) {
  // Several stops easing out, so the glow has no edge where it ends.
  const a = theme.dark ? ['2E', '1A', '0A', '03', '00'] : ['24', '14', '08', '02', '00'];
  return (
    <LinearGradient
      colors={[theme.accent + a[0], theme.accent + a[1], theme.accent + a[2], theme.accent + a[3], theme.accent + a[4]]}
      locations={[0, 0.25, 0.5, 0.75, 1]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.55, y: 1 }}
      style={styles.glow}
      pointerEvents="none"
    />
  );
}

/**
 * What every page stands on: the theme's ground, the glow, and room for the header above the content. The
 * glow is here, once, so no page can be without it. `floating` pages run up under the header themselves.
 */
export function PageGround({ floating, children }: { floating?: boolean; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { backgroundColor: theme.bg }]}>
      <Glow theme={theme} />
      <View style={[styles.page, !floating && { paddingTop: insets.top + HEADER }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 520 },
});
