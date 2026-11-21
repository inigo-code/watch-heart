import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { fonts } from '@/lib/theme';

// The native splash: assets/splash-icon.png at 160 points on the projector black (app.json). The reel below is
// that icon redrawn from plain shapes, measured from the 1024 px file, so it's on screen in the very first
// frame: an image loads a moment later, and closing the native splash before it did showed plain black.
export const SPLASH_BG = '#0B0A0D';
const BG = SPLASH_BG;
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
// How long the native splash takes to fade off the top of this one (Android), and the longest to wait for this
// one to reach the screen before letting the native splash go anyway.
const FADE = 150;
const UNCOVER_AT_MOST = 1500;

/** The reel: a gold disc with six holes round a centre one, and a pink heart in the middle. App lock's cover
 * draws it too, so the opening looks the same whichever is on top. */
export function Reel() {
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
export function SplashOverlay({ ready, covered = false }: { ready: boolean; covered?: boolean }) {
  const [spin] = useState(() => new Animated.Value(0));
  const [word] = useState(() => new Animated.Value(0));
  const [leave] = useState(() => new Animated.Value(0));
  const [probe] = useState(() => new Animated.Value(0));
  const [uncovered, setUncovered] = useState(false);
  const handedOver = useRef(false);
  const [introDone, setIntroDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [gone, setGone] = useState(false);

  // While the native splash is up, Android draws nothing of the app. Letting it go a couple of JavaScript frames
  // after layout was too soon on phones: the native side was still putting the screen together, so the logo
  // faded out over plain black for a moment before this double appeared. A one-frame animation run by the
  // native side on this view can only finish once the view is there, so the native splash goes after that.
  // The spin waits until the native splash has faded off, so the two logos never disagree.
  const onLayout = () => {
    if (handedOver.current) return;
    handedOver.current = true;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      try {
        SplashScreen.setOptions?.({ duration: FADE, fade: true });
      } catch {}
      SplashScreen.hideAsync()
        .catch(() => {})
        .finally(() => setTimeout(() => setUncovered(true), FADE));
    };
    Animated.timing(probe, { toValue: 1, duration: 16, useNativeDriver: true }).start(release);
    setTimeout(release, UNCOVER_AT_MOST);
  };

  useEffect(() => {
    // App lock's cover (a still copy of this) sits on top until the settings are in; spinning under it would
    // show the moment it lifts.
    if (!uncovered || covered) return;
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
  }, [spin, word, uncovered, covered]);

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
      <Animated.View style={{ transform: [{ translateX: probe.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }) }, { rotate }, { scale: beat }, { scale: leave.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }}>
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
