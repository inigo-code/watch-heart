import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { EASE, ENTER } from '@/components/Motion';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

const H = 44;
const PAD = 3;

type Option<K> = { key: K; label: string; icon?: keyof typeof Ionicons.glyphMap };

/**
 * The app's one switch, for choosing between views: the lit pill slides to the side you tap. `pill` and
 * `onPill` colour it; each page's switches otherwise look the same.
 */
export function Segments<K extends string | number>({ theme, options, value, onChange, pill, onPill }: {
  theme: Theme;
  options: Option<K>[];
  value: K;
  onChange: (k: K) => void;
  pill?: string;
  onPill?: string;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  // The pill moves by option, not by pixel: a width that settles after the first layout (or a turned
  // phone) then puts it straight in place instead of chasing an old position.
  const [at] = useState(() => new Animated.Value(index));
  const each = width ? (width - PAD * 2) / options.length : 0;
  useEffect(() => {
    Animated.timing(at, { toValue: index, duration: ENTER * 0.7, easing: EASE, useNativeDriver: true }).start();
  }, [at, index]);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist" style={[styles.wrap, { backgroundColor: theme.chip }]}>
      {each > 0 && <Animated.View style={[styles.pill, { width: each, backgroundColor: pill ?? theme.chipActive, transform: [{ translateX: Animated.multiply(at, each) }] }]} />}
      {options.map((o) => {
        const on = o.key === value;
        const color = on ? (onPill ?? theme.chipActiveText) : theme.textMuted;
        return (
          <Pressable key={String(o.key)} onPress={() => onChange(o.key)} accessibilityRole="tab" accessibilityLabel={o.label} accessibilityState={{ selected: on }} hitSlop={{ top: 4, bottom: 4 }} style={styles.option}>
            {o.icon && <Ionicons name={o.icon} size={16} color={color} />}
            <Text numberOfLines={1} style={[styles.label, { color }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', height: H, borderRadius: H / 2, padding: PAD },
  pill: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: (H - PAD * 2) / 2 },
  option: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.uiSemibold, fontSize: font.caption },
});
