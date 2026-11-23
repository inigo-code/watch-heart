import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { TicketStub } from '@/components/Diary';
import { EASE } from '@/components/Motion';
import { useHaptic } from '@/lib/haptics';
import { fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { Entry } from '@/store/types';

/**
 * The app's one flourish: the new entry's own Diary ticket comes up as if printed, a LOGGED stamp comes down on
 * it with a thump under the finger, it sits for a moment, and the form closes. `onDone` must keep its identity
 * between renders. With reduced motion the form doesn't show this at all.
 */
export function LoggedStamp({ theme, entry, onDone }: { theme: Theme; entry: Entry; onDone: () => void }) {
  const [print] = useState(() => new Animated.Value(0));
  const [hit] = useState(() => new Animated.Value(0));
  const haptic = useHaptic();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    Animated.sequence([
      Animated.timing(print, { toValue: 1, duration: 300, easing: EASE, useNativeDriver: true }),
      Animated.timing(hit, { toValue: 1, duration: 170, easing: EASE, useNativeDriver: true }),
    ]).start(() => {
      haptic('stamp');
      timer = setTimeout(onDone, 650);
    });
    return () => clearTimeout(timer);
  }, [print, hit, haptic, onDone]);
  const rise = print.interpolate({ inputRange: [0, 1], outputRange: [48, 0] });
  const scale = hit.interpolate({ inputRange: [0, 1], outputRange: [1.9, 1] });
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: theme.overlay, opacity: print }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${entry.title} logged`}
    >
      <Animated.View style={[styles.ticket, { transform: [{ translateY: rise }] }]}>
        <TicketStub entry={entry} theme={theme} lovedStamp={false} />
        <View style={styles.stampSpot} pointerEvents="none">
          <Animated.View style={[styles.stamp, { borderColor: theme.accent, opacity: hit, transform: [{ rotate: '-9deg' }, { scale }] }]}>
            <Text style={[styles.logged, { color: theme.accent }]}>LOGGED</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center', padding: 16 },
  ticket: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  // Over the right of the ticket, clear of the date on the stub.
  stampSpot: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 14 },
  stamp: { borderWidth: 2.5, borderRadius: 8, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 2 },
  logged: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, letterSpacing: 2, includeFontPadding: false },
});
