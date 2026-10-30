import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/lib/theme';

// The native splash: assets/splash-icon.png at 160 points on the projector black (app.json). The reel below is
// that icon redrawn from plain shapes, measured from the 1024 px file, so it's on screen in the very first
// frame: an image loads a moment later, and closing the native splash before it did showed plain black.
const BG = '#0B0A0D';
const GOLD = '#F2B84B';
const PINK = '#FF4D6D';
const SIZE = 160;
const K = SIZE / 1024;
const DISC = 720 * K;
const HOLE = 152 * K;
const HOLE_AT = 216 * K;
const CENTRE = 216 * K;
// The heart, measured in the file: 170 × 151 from (427, 447), two round lobes (radius 47, centres 76 apart,
// so the notch is shallow) over a diamond, stretched a little sideways, that comes to the point.
const HEART = { x: (427 - 152) * K, y: (447 - 152) * K, w: 170 * K, h: 151 * K };
const LOBE = 94 * K;
// The diamond's tip sits at the bottom (150) and its top well under the notch (30).
const DIAMOND = 60 * Math.SQRT2 * K;
// The longest the app waits on its data before letting go anyway.
const WAIT_AT_MOST = 3000;

/** The reel: a gold disc with six holes round a centre one, and a pink heart in the middle. */
function Reel() {
  return (
    <View style={styles.reelBox}>
      <View style={styles.disc}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = ((i * 60 - 90) * Math.PI) / 180;
          return (
            <View
              key={i}
              style={[styles.hole, { left: DISC / 2 + HOLE_AT * Math.cos(angle) - HOLE / 2, top: DISC / 2 + HOLE_AT * Math.sin(angle) - HOLE / 2 }]}
            />
          );
        })}
        <View style={styles.centre} />
        <View style={styles.heart}>
          <View style={[styles.heartPart, styles.diamond]} />
          <View style={[styles.heartPart, styles.lobe, { left: -0.5 * K }]} />
          <View style={[styles.heartPart, styles.lobe, { left: 75.5 * K }]} />
        </View>
      </View>
    </View>
  );
}

/**
 * The opening: drawn exactly as the native splash looks, so the hand-over can't be seen; the reel spins one
 * turn (its six holes land where they started), the name fades in under it, and the whole thing fades away
 * as the app appears. Waits for `ready` (settings and diary loaded), or 3 s at most. With reduced motion it
 * only fades.
 */
export function SplashOverlay({ ready }: { ready: boolean }) {
  const [spin] = useState(() => new Animated.Value(0));
  const [word] = useState(() => new Animated.Value(0));
  const [leave] = useState(() => new Animated.Value(0));
  const [introDone, setIntroDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [gone, setGone] = useState(false);

  // Everything here is drawn in the first frame (no images), so the native splash can go two frames after
  // layout, by when the double is on screen.
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
          Animated.timing(spin, { toValue: 1, duration: 900, delay: 60, easing: Easing.bezier(0.45, 0, 0.2, 1), useNativeDriver: true }),
          Animated.timing(word, { toValue: 1, duration: 420, delay: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
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
      <Animated.View style={{ transform: [{ rotate }, { scale: beat }, { scale: leave.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }}>
        <Reel />
      </Animated.View>
      <Animated.View style={[styles.wordWrap, { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        <Text style={styles.word} allowFontScaling={false}>
          WATCH <Text style={styles.heart2}>HEART</Text>
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  reelBox: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  disc: { width: DISC, height: DISC, borderRadius: DISC / 2, backgroundColor: GOLD },
  hole: { position: 'absolute', width: HOLE, height: HOLE, borderRadius: HOLE / 2, backgroundColor: BG },
  centre: { position: 'absolute', width: CENTRE, height: CENTRE, borderRadius: CENTRE / 2, left: (DISC - CENTRE) / 2, top: (DISC - CENTRE) / 2, backgroundColor: BG },
  heart: { position: 'absolute', left: HEART.x, top: HEART.y, width: HEART.w, height: HEART.h },
  heartPart: { position: 'absolute', backgroundColor: PINK },
  lobe: { top: 0, width: LOBE, height: LOBE, borderRadius: LOBE / 2 },
  diamond: { width: DIAMOND, height: DIAMOND, left: 84.5 * K - DIAMOND / 2, top: 90 * K - DIAMOND / 2, transform: [{ scaleX: 1.08 }, { rotate: '45deg' }] },
  // Below the reel, so the reel stays exactly where the native splash had it.
  wordWrap: { position: 'absolute', top: '50%', marginTop: SIZE / 2 + 4 },
  word: { fontFamily: fonts.display, fontSize: 34, letterSpacing: 3, color: '#F4EFE6' },
  heart2: { color: GOLD },
});
