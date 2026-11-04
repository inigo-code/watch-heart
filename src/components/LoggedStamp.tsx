import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { HeartMark } from '@/components/BrandTitle';
import { EASE } from '@/components/Motion';
import { fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/**
 * The app's one flourish: a title goes in the diary with the thump of a ticket being stamped. It comes down
 * fast, sits for a moment, and the form closes. `onDone` must keep its identity between renders.
 */
export function LoggedStamp({ theme, title, onDone }: { theme: Theme; title: string; onDone: () => void }) {
  const [hit] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.sequence([Animated.timing(hit, { toValue: 1, duration: 240, easing: EASE, useNativeDriver: true }), Animated.delay(460)]).start(() => onDone());
  }, [hit, onDone]);
  const scale = hit.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] });
  const opacity = hit.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] });
  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: theme.overlay }]} accessibilityLiveRegion="polite" accessibilityLabel={`${title} logged`}>
      <Animated.View style={[styles.stamp, { backgroundColor: theme.card, borderColor: theme.accent, opacity, transform: [{ rotate: '-5deg' }, { scale }] }]}>
        <HeartMark size={44} />
        <Text style={[styles.logged, { color: theme.accent }]}>LOGGED</Text>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {title.toUpperCase()}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  stamp: { alignItems: 'center', gap: 6, maxWidth: 280, borderWidth: 2, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 20 },
  logged: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: 3, includeFontPadding: false },
  title: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 1, textAlign: 'center' },
});
