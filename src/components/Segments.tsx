import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { EASE, ENTER } from '@/components/Motion';
import { fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

const H = 40;
const PAD = 3;

/** A two-way switch: the lit pill slides to the side you tap. */
export function Segments<K extends string>({ theme, options, value, onChange }: { theme: Theme; options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const [width, setWidth] = useState(0);
  const [at] = useState(() => new Animated.Value(0));
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const each = width ? (width - PAD * 2) / options.length : 0;
  useEffect(() => {
    Animated.timing(at, { toValue: index * each, duration: ENTER * 0.7, easing: EASE, useNativeDriver: true }).start();
  }, [at, index, each]);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist" style={[styles.wrap, { backgroundColor: theme.chip }]}>
      {each > 0 && <Animated.View style={[styles.pill, { width: each, backgroundColor: theme.chipActive, transform: [{ translateX: at }] }]} />}
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="tab" accessibilityState={{ selected: o.key === value }} style={styles.option}>
          <Text numberOfLines={1} style={[styles.label, { color: o.key === value ? theme.chipActiveText : theme.textMuted }]}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', height: H, borderRadius: H / 2, padding: PAD },
  pill: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: (H - PAD * 2) / 2 },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 0.8 },
});
