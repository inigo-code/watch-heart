import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import type { Theme } from '@/lib/theme';

/**
 * A soft wash of the accent at the top of a main screen, fading into the page, like light from the screen
 * in a dark hall: the page reads as lit, not flat black. First child of the screen, so everything sits on it.
 */
export function ScreenGlow({ theme, height = 520 }: { theme: Theme; height?: number }) {
  // Several stops easing out, so the glow has no edge where it ends.
  const a = theme.dark ? ['2E', '1A', '0A', '03', '00'] : ['24', '14', '08', '02', '00'];
  return (
    <LinearGradient
      colors={[theme.accent + a[0], theme.accent + a[1], theme.accent + a[2], theme.accent + a[3], theme.accent + a[4]]}
      locations={[0, 0.25, 0.5, 0.75, 1]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.55, y: 1 }}
      style={[styles.glow, { height }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0 },
});
