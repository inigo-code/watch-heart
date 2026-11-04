import { useEffect, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Text } from '@/components/AppText';

// The app's motion, in one place. One curve (a confident stop), a few short durations, only opacity and
// transform so it runs on the UI thread, and all of it stands down for people who turn animations off.

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const QUICK = 120;
export const ENTER = 320;

/** Whether the phone asks for reduced motion. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => live && setReduced(r))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that gives under the finger: a tiny scale down, and back. */
export function Tap({ scale = 0.97, style, onPressIn, onPressOut, ...rest }: Omit<ComponentProps<typeof Pressable>, 'style'> & { scale?: number; style?: StyleProp<ViewStyle> }) {
  const [press] = useState(() => new Animated.Value(1));
  const to = (toValue: number) => Animated.timing(press, { toValue, duration: QUICK, easing: EASE, useNativeDriver: true }).start();
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        to(scale);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale: press }] }]}
    />
  );
}

/** Fades and rises a few points into place when it appears. `order` staggers siblings, up to six of them. */
export function Rise({ order = 0, children, style }: { order?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(shown, { toValue: 1, duration: ENTER, delay: Math.min(order, 6) * 40, easing: EASE, useNativeDriver: true }).start();
  }, [shown, order]);
  const translateY = shown.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 10, 0] });
  return <Animated.View style={[style, { opacity: shown, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** A small thump each time `when` changes: a star set, a heart given. */
export function Pop({ when, children, style }: { when: unknown; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const last = useRef(when);
  useEffect(() => {
    if (last.current === when) return;
    last.current = when;
    if (reduced) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration: 90, easing: EASE, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 220, easing: EASE, useNativeDriver: true }),
    ]).start();
  }, [when, reduced, scale]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** A number that counts up to its value when it first appears. */
export function CountUp({ value, style, format = String }: { value: number; style?: ComponentProps<typeof Text>['style']; format?: (n: number) => string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduced || value <= 0) return;
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / 600);
      setShown(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <Text style={style}>{format(reduced ? value : shown)}</Text>;
}
