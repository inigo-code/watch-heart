import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/AppText';
import { EASE, useReducedMotion } from '@/components/Motion';
import { fonts } from '@/lib/theme';

// Watch Heart's mascot, Iniya: a film-loving girl in the logo's colours (gold cardigan, the reel-and-heart pin, a pink
// scrunchie). She replaced Reel, the reel come alive. Drawn as six still poses on a cream sticker edge, so she
// reads on the dark and the light theme alike. The drawings and how they were made: docs/mascot-character.md.

export type MascotPose = 'hello' | 'welcome' | 'diary' | 'asleep' | 'oops' | 'cheer';

const POSES: Record<MascotPose, { src: number; ratio: number }> = {
  hello: { src: require('../../assets/mascot/hello.webp'), ratio: 324 / 640 },
  welcome: { src: require('../../assets/mascot/welcome.webp'), ratio: 359 / 640 },
  diary: { src: require('../../assets/mascot/diary.webp'), ratio: 383 / 640 },
  asleep: { src: require('../../assets/mascot/asleep.webp'), ratio: 640 / 594 },
  oops: { src: require('../../assets/mascot/oops.webp'), ratio: 371 / 640 },
  cheer: { src: require('../../assets/mascot/cheer.webp'), ratio: 415 / 640 },
};

const INK = '#120F08';
const CREAM = '#F4EFE6';

/**
 * The mascot. `height` sets her size; her width follows the pose. She fades and rises in when she appears and
 * gives a small shake when she turns to "oops"; with reduced motion she just appears. Decorative: TalkBack skips
 * her, the words beside her carry the meaning.
 */
export function Mascot({ pose = 'hello', height = 120, style }: { pose?: MascotPose; height?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [rise] = useState(() => new Animated.Value(0));
  const [shake] = useState(() => new Animated.Value(0));
  const p = POSES[pose];

  useEffect(() => {
    if (reduced) rise.setValue(1);
    else Animated.timing(rise, { toValue: 1, duration: 360, easing: EASE, useNativeDriver: true }).start();
  }, [rise, reduced]);

  useEffect(() => {
    if (pose !== 'oops' || reduced) return;
    shake.setValue(0);
    Animated.sequence(
      [1, -1, 0.6, -0.4, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 70, easing: Easing.linear, useNativeDriver: true })),
    ).start();
  }, [pose, shake, reduced]);

  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] });

  return (
    <Animated.View
      style={[{ width: height * p.ratio, height, opacity: rise, transform: [{ translateY }, { translateX }] }, style]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
    >
      <Image source={p.src} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} accessible={false} />
    </Animated.View>
  );
}

/**
 * A small paper ticket with a word or two on it, the kind the mascot holds up: cream, typed, a little crooked,
 * with a notch punched from each end. `hole` is the colour behind it (the page), showing through the notches.
 */
export function PaperTicket({ text, hole, size = 12, tilt = -5, style }: { text: string; hole: string; size?: number; tilt?: number; style?: StyleProp<ViewStyle> }) {
  const n = Math.round(size * 0.45);
  return (
    <View style={[styles.ticket, { paddingHorizontal: size, paddingVertical: size * 0.5, transform: [{ rotate: `${tilt}deg` }] }, style]}>
      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={{ fontFamily: fonts.ticketBold, fontSize: size, lineHeight: size * 1.15, letterSpacing: size * 0.16, color: INK }}>
        {text.toUpperCase()}
      </Text>
      <View style={[styles.notch, { width: n * 2, height: n * 2, borderRadius: n, left: -n, marginTop: -n, backgroundColor: hole }]} />
      <View style={[styles.notch, { width: n * 2, height: n * 2, borderRadius: n, right: -n, marginTop: -n, backgroundColor: hole }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: { alignSelf: 'center', backgroundColor: CREAM, overflow: 'hidden' },
  notch: { position: 'absolute', top: '50%' },
});
