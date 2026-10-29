import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { KIND_LABEL } from '@/lib/stats';
import { font, fonts, kindColor } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { MediaKind } from '@/store/types';

// The film-flavoured building blocks: posters, stars, kind badges, sprocket strips and filter chips.

/** A 2:3 poster. Without an image it shows a slate with the title in marquee letters. */
export function Poster({ uri, title, width, theme, radius = 6, style }: {
  uri: string | null;
  title: string;
  width: number;
  theme: Theme;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [failed, setFailed] = useState(false);
  const height = width * 1.5;
  return (
    <View style={[{ width, height, borderRadius: radius, backgroundColor: theme.elevated, overflow: 'hidden' }, style]}>
      {uri && !failed ? (
        // Kept in memory as well as on disk, so scrolling back up is instant, with no second fade-in.
        <Image source={uri} recyclingKey={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" onError={() => setFailed(true)} />
      ) : (
        <View style={styles.slate}>
          <Ionicons name="film-outline" size={Math.max(14, width * 0.26)} color={theme.textMuted} />
          {width >= 60 && (
            <Text style={[styles.slateText, { color: theme.textMuted, fontSize: Math.max(11, width * 0.14) }]} numberOfLines={3}>
              {title.toUpperCase()}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/** Read-only stars for a half-star rating (0–10). */
export function Stars({ rating, size = 14, color, emptyColor, showEmpty = false }: {
  rating: number;
  size?: number;
  color: string;
  emptyColor?: string;
  /** Show all five, with the unearned ones outlined. */
  showEmpty?: boolean;
}) {
  if (!rating && !showEmpty) return null;
  const stars: ReactNode[] = [];
  for (let i = 1; i <= 5; i++) {
    const full = rating >= i * 2;
    const half = !full && rating === i * 2 - 1;
    if (!full && !half && !showEmpty) break;
    stars.push(
      <Ionicons
        key={i}
        name={full ? 'star' : half ? 'star-half' : 'star-outline'}
        size={size}
        color={full || half ? color : (emptyColor ?? color)}
      />,
    );
  }
  return (
    <View style={styles.stars} accessibilityLabel={`${rating / 2} stars`}>
      {stars}
    </View>
  );
}

/**
 * Tap or slide across the five stars to rate in half stars; the left half of a star is a half.
 * Tapping the current rating again clears it.
 */
export function StarInput({ value, onChange, theme, size = 40 }: { value: number; onChange: (v: number) => void; theme: Theme; size?: number }) {
  const [width, setWidth] = useState(0);
  const at = (x: number) => Math.min(10, Math.max(1, Math.ceil((x / width) * 10)));
  // The rating when the touch began, and whether the finger slid to another value since.
  const touch = useRef<{ before: number; moved: boolean } | null>(null);
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        if (!width) return;
        touch.current = { before: value, moved: false };
        onChange(at(e.nativeEvent.locationX));
      }}
      onResponderMove={(e) => {
        if (!width || !touch.current) return;
        const v = at(e.nativeEvent.locationX);
        if (v !== value) touch.current.moved = true;
        onChange(v);
      }}
      onResponderRelease={(e) => {
        // A plain tap on the rating you already had clears it.
        const t = touch.current;
        if (width && t && !t.moved && at(e.nativeEvent.locationX) === t.before) onChange(0);
        touch.current = null;
      }}
      accessibilityRole="adjustable"
      accessibilityLabel="Rating"
      accessibilityValue={{ text: value ? `${value / 2} stars` : 'Not rated' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.min(10, Math.max(0, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
      style={styles.starInput}
    >
      <View pointerEvents="none">
        <Stars rating={value} size={size} color={theme.star} emptyColor={theme.border} showEmpty />
      </View>
    </View>
  );
}

/** FILM / SERIES / ANIME in typewriter caps, tinted per kind. */
export function KindBadge({ kind, theme, small }: { kind: MediaKind; theme: Theme; small?: boolean }) {
  const color = kindColor(kind, theme);
  return (
    <View style={[styles.badge, { borderColor: color + '88', backgroundColor: color + '1A' }, small && styles.badgeSmall]}>
      <Text style={[styles.badgeText, { color }, small && styles.badgeTextSmall]}>{KIND_LABEL[kind].toUpperCase()}</Text>
    </View>
  );
}

/** A row of sprocket holes, like the edge of a strip of film. */
export function Sprockets({ color, count = 14, hole = 7 }: { color: string; count?: number; hole?: number }) {
  return (
    <View style={styles.sprockets} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: hole * 1.4, height: hole, borderRadius: 2, backgroundColor: color }} />
      ))}
    </View>
  );
}

/** A filter chip in typewriter caps. */
export function Chip({ label, active, icon, color, theme, onPress }: {
  label: string;
  active?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  theme: Theme;
  onPress: () => void;
}) {
  const fg = active ? theme.chipActiveText : theme.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? theme.chipActive : 'transparent', borderColor: active ? theme.chipActive : theme.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      {icon && <Ionicons name={icon} size={14} color={color && !active ? color : fg} />}
      {!icon && color && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.chipText, { color: fg }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 6 },
  slateText: { fontFamily: fonts.display, textAlign: 'center', letterSpacing: 0.5 },
  stars: { flexDirection: 'row', gap: 1 },
  starInput: { alignSelf: 'flex-start', paddingVertical: 4 },
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'flex-start' },
  badgeSmall: { paddingHorizontal: 4, paddingVertical: 0 },
  badgeText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  badgeTextSmall: { fontSize: 10 },
  sprockets: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
});
