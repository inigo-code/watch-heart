import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text } from 'react-native';

import { fonts } from '@/lib/theme';

const ICON = require('../../assets/splash-icon.png');
// The native splash: the reel at 160 points on the projector black (app.json, expo-splash-screen).
const BG = '#0B0A0D';
const SIZE = 160;
// The longest the app waits on its data before letting go anyway.
const WAIT_AT_MOST = 3000;

/**
 * The opening: starts exactly as the native splash looks, so the hand-over can't be seen, then the reel
 * spins one turn (its six holes land where they started), the name fades in under it, and the whole thing
 * fades away as the app appears. Waits for `ready` (settings and diary loaded), or 3 s at most. With
 * reduced motion it only fades.
 */
export function SplashOverlay({ ready }: { ready: boolean }) {
  const [spin] = useState(() => new Animated.Value(0));
  const [word] = useState(() => new Animated.Value(0));
  const [leave] = useState(() => new Animated.Value(0));
  const [introDone, setIntroDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [gone, setGone] = useState(false);

  // The native splash goes as soon as this, its double, is on screen.
  // Not on layout itself: layout comes a frame before anything is drawn, and closing the native splash then
  // shows the empty window for that frame (a black blink). Two frames later the double is on screen.
  const onLayout = () => requestAnimationFrame(() => requestAnimationFrame(() => SplashScreen.hideAsync().catch(() => {})));

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (!live) return;
        if (reduced) {
          word.setValue(1);
          setIntroDone(true);
          return;
        }
        Animated.parallel([
          Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.bezier(0.45, 0, 0.2, 1), useNativeDriver: true }),
          Animated.timing(word, { toValue: 1, duration: 420, delay: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]).start(() => live && setIntroDone(true));
      });
    const timer = setTimeout(() => live && setTimedOut(true), WAIT_AT_MOST);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [spin, word]);

  const leaving = introDone && (ready || timedOut);
  useEffect(() => {
    if (!leaving) return;
    Animated.timing(leave, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() => setGone(true));
  }, [leaving, leave]);

  if (gone) return null;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // A small heartbeat as the spin settles.
  const beat = spin.interpolate({ inputRange: [0, 0.85, 0.93, 1], outputRange: [1, 1, 1.06, 1] });
  return (
    <Animated.View
      onLayout={onLayout}
      pointerEvents="none"
      style={[styles.wrap, { opacity: leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.Image
        source={ICON}
        style={[styles.icon, { transform: [{ rotate }, { scale: beat }, { scale: leave.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }]}
      />
      <Animated.View style={[styles.wordWrap, { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        <Text style={styles.word}>
          WATCH <Text style={styles.heart}>HEART</Text>
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  icon: { width: SIZE, height: SIZE },
  // Below the reel, so the reel stays exactly where the native splash had it.
  wordWrap: { position: 'absolute', top: '50%', marginTop: SIZE / 2 + 4 },
  word: { fontFamily: fonts.display, fontSize: 34, letterSpacing: 3, color: '#F4EFE6' },
  heart: { color: '#F2B84B' },
});

