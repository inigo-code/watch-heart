import { Animated, StyleSheet } from 'react-native';

import type { Theme } from '@/lib/theme';

// The height of Android's top bar, under the status bar.
const BAR = 56;

/**
 * The top bar's ground on a page whose top is a picture: clear over the picture, then the page's colour
 * once the picture has scrolled away, so text never runs under the back button. Put it after the page's
 * scroll view; `from` is how far down the picture ends.
 */
export function TopScrim({ scrollY, theme, topInset, from }: { scrollY: Animated.Value; theme: Theme; topInset: number; from: number }) {
  const opacity = scrollY.interpolate({ inputRange: [from - 80, from], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.scrim, { height: topInset + BAR, backgroundColor: theme.bg, borderBottomColor: theme.border, opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: StyleSheet.hairlineWidth },
});
