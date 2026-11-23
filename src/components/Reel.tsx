import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/AppText';
import { EASE, useReducedMotion } from '@/components/Motion';
import { fonts } from '@/lib/theme';

// Reel, Watch Heart's mascot: the app icon's reel come alive. Two of its six holes are his eyes, the bottom one
// his mouth, the heart sits in the middle. No limbs, no outline: one shape, read at a glance. Drawn from plain
// Views like the splash (no SVG library), measured from the website's drawing (Watch Heart Web
// src/ui/Mascot.tsx), whose proportions come from the icon. See docs/reel-mascot-plan.md.

export type ReelMood = 'idle' | 'look' | 'shy' | 'oops';

const GOLD = '#F2B84B';
const RIM = '#D99A2B';
const SHINE = '#FFE0A0';
const INK = '#120F08';
const PINK = '#FF4D6D';
const CREAM = '#F4EFE6';

// The website's box: 176 × 186 units, the reel's centre at (88, 88), radius 80.
const W = 176;
const H = 186;
const C = { x: 88, y: 88 };
const R = 80;
const HOLE = 16.7;
const AT = 47.8;
const hole = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C.x + Math.sin(a) * AT, y: C.y - Math.cos(a) * AT };
};
const TOP = hole(0);
const LOW_R = hole(120);
const LOW_L = hole(240);
const EYE_L = hole(300);
const EYE_R = hole(60);
const MOUTH = hole(180);

const LEAN: Record<ReelMood, string> = { idle: '0deg', look: '7deg', shy: '-9deg', oops: '0deg' };

/**
 * Reel. `size` is his width; `mood` changes his face; `look` (0 to 1) moves the glints in his eyes along a
 * line of text being typed. `spins` turns him once each time it goes up (a tap on Home). He pops in when he
 * appears, blinks every few seconds and his heart beats now and then; with reduced motion he stays still, but
 * his face still changes. Decorative: TalkBack skips him, the words beside him carry the meaning.
 */
export function Reel({ size = 96, mood = 'idle', look = 0.5, spins = 0, style }: { size?: number; mood?: ReelMood; look?: number; spins?: number; style?: StyleProp<ViewStyle> }) {
  const k = size / W;
  const u = (n: number) => n * k;
  const reduced = useReducedMotion();
  const [pop] = useState(() => new Animated.Value(0));
  const [blink] = useState(() => new Animated.Value(1));
  const [beat] = useState(() => new Animated.Value(1));
  const [lean] = useState(() => new Animated.Value(0));
  const [shake] = useState(() => new Animated.Value(0));
  const [turn] = useState(() => new Animated.Value(0));

  // Arrive: a small pop.
  useEffect(() => {
    if (reduced) pop.setValue(1);
    else Animated.timing(pop, { toValue: 1, duration: 420, easing: EASE, useNativeDriver: true }).start();
  }, [pop, reduced]);

  // Blink every few seconds, and a heart beat now and then.
  useEffect(() => {
    if (reduced) return;
    const blinking = Animated.loop(
      Animated.sequence([
        Animated.delay(3600),
        Animated.timing(blink, { toValue: 0.1, duration: 70, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 110, useNativeDriver: true }),
      ]),
    );
    const beating = Animated.loop(
      Animated.sequence([
        Animated.delay(5200),
        Animated.timing(beat, { toValue: 1.18, duration: 140, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1.12, duration: 120, useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
    );
    blinking.start();
    beating.start();
    return () => {
      blinking.stop();
      beating.stop();
    };
  }, [blink, beat, reduced]);

  // Lean with the mood; a little shake for "oops".
  useEffect(() => {
    const to = mood === 'look' ? 1 : mood === 'shy' ? -1 : 0;
    if (reduced) lean.setValue(to);
    else Animated.timing(lean, { toValue: to, duration: 260, easing: EASE, useNativeDriver: true }).start();
    if (mood === 'oops' && !reduced) {
      shake.setValue(0);
      Animated.sequence(
        [1, -1, 0.7, -0.5, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 70, easing: Easing.linear, useNativeDriver: true })),
      ).start();
    }
  }, [mood, lean, shake, reduced]);

  // One full turn backwards for each tap.
  useEffect(() => {
    if (!spins || reduced) return;
    turn.setValue(0);
    Animated.timing(turn, { toValue: 1, duration: 760, easing: EASE, useNativeDriver: true }).start();
  }, [spins, turn, reduced]);

  const rotate = lean.interpolate({ inputRange: [-1, 0, 1], outputRange: [LEAN.shy, '0deg', LEAN.look] });
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-u(6), u(6)] });
  const spin = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  // The glints sit up and right, looking at you; while you type they follow the text.
  const gx = mood === 'look' ? -4 + Math.max(0, Math.min(1, look)) * 10 : 3;
  const gy = mood === 'look' ? 3 : -4;
  const circle = (x: number, y: number, r: number, color: string, extra?: ViewStyle): ViewStyle => ({
    position: 'absolute',
    left: u(x - r),
    top: u(y - r),
    width: u(r * 2),
    height: u(r * 2),
    borderRadius: u(r),
    backgroundColor: color,
    ...extra,
  });
  const eyesOpen = mood !== 'shy';

  return (
    <View style={[{ width: u(W), height: u(H) }, style]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
      {/* His shadow on the floor */}
      <Animated.View style={{ position: 'absolute', left: u(C.x - 58), top: u(178 - 6), width: u(116), height: u(12), borderRadius: u(6), backgroundColor: '#000', opacity: Animated.multiply(pop, 0.35) }} />

      <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: u(W), height: u(W), opacity: pop, transform: [{ translateX: shakeX }, { scale }, { rotate }, { rotate: spin }] }}>
        {/* The reel: a disc, a rim a shade deeper, a soft light on its upper edge */}
        <View style={circle(C.x, C.y, R, GOLD)} />
        <View style={circle(C.x, C.y, R - 7, 'transparent', { borderWidth: Math.max(1, u(2)), borderColor: RIM, opacity: 0.55 })} />
        <View style={circle(C.x, C.y, R - 4, 'transparent', { borderWidth: u(4), borderColor: 'transparent', borderTopColor: SHINE, opacity: 0.6, transform: [{ rotate: '-28deg' }] })} />

        {/* The three holes that stay holes, the hub and its heart */}
        {[TOP, LOW_L, LOW_R].map((p, i) => (
          <View key={i} style={circle(p.x, p.y, HOLE, INK)} />
        ))}
        <View style={circle(C.x, C.y, 24, INK)} />
        <Animated.View style={{ position: 'absolute', left: u(C.x - 18), top: u(C.y - 18), width: u(36), height: u(36), transform: [{ scale: beat }] }}>
          {/* Two round lobes over a diamond that comes to the point, as the splash draws it. */}
          <View style={[styles.abs, { left: u(18 - 7.8), top: u(20 - 7.8), width: u(15.6), height: u(15.6), backgroundColor: PINK, transform: [{ rotate: '45deg' }] }]} />
          <View style={circle(9.3, 11.4, 8.5, PINK)} />
          <View style={circle(26.7, 11.4, 8.5, PINK)} />
        </Animated.View>

        {/* Eyes: open holes with a glint, or shut into a curve */}
        {eyesOpen ? (
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: u(EYE_L.y - W / 2) }, { scaleY: blink }, { translateY: -u(EYE_L.y - W / 2) }] }]}>
            <View style={circle(EYE_L.x, EYE_L.y, HOLE, INK, { height: u(HOLE * 2 + 2), top: u(EYE_L.y - HOLE - 1) })} />
            <View style={circle(EYE_R.x, EYE_R.y, HOLE, INK, { height: u(HOLE * 2 + 2), top: u(EYE_R.y - HOLE - 1) })} />
            <View style={circle(EYE_L.x + gx, EYE_L.y + gy, 5, CREAM)} />
            <View style={circle(EYE_R.x + gx, EYE_R.y + gy, 5, CREAM)} />
          </Animated.View>
        ) : (
          [EYE_L, EYE_R].map((p, i) => (
            <View
              key={i}
              style={[
                styles.abs,
                {
                  left: u(p.x - 12),
                  top: u(p.y - 8),
                  width: u(24),
                  height: u(12),
                  borderBottomWidth: u(6),
                  borderLeftWidth: u(2),
                  borderRightWidth: u(2),
                  borderColor: INK,
                  borderBottomLeftRadius: u(12),
                  borderBottomRightRadius: u(12),
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                },
              ]}
            />
          ))
        )}

        {/* Mouth: the bottom hole, smiling, or a small round "oh" */}
        {mood === 'oops' ? (
          <View style={circle(MOUTH.x, MOUTH.y, 8, INK)} />
        ) : (
          <View style={[styles.abs, { left: u(MOUTH.x - 17), top: u(MOUTH.y - 7), width: u(34), height: u(17), borderBottomLeftRadius: u(17), borderBottomRightRadius: u(17), backgroundColor: INK }]} />
        )}
      </Animated.View>
    </View>
  );
}

/**
 * A small paper ticket with a word or two on it, the kind Reel holds up: cream, typed, a little crooked,
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

/** What's on at this hour, as a cinema would put it. */
export function showTime(hour = new Date().getHours()) {
  return hour < 5 ? 'Late show' : hour < 12 ? 'Morning show' : hour < 17 ? 'Matinee' : hour < 22 ? 'Evening show' : 'Late show';
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  ticket: { alignSelf: 'center', backgroundColor: CREAM, overflow: 'hidden' },
  notch: { position: 'absolute', top: '50%' },
});
