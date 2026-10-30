import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BrandTitle } from '@/components/BrandTitle';
import { useReducedMotion } from '@/lib/motion';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useSync } from '@/sync/SyncProvider';

type MciName = keyof typeof MaterialCommunityIcons.glyphMap;

/** The top of Home: the title on a marquee, your photo (to your profile), Settings, and a line below. */
export function AppHeader({ theme, line, icon }: { theme: Theme; line: string; icon?: MciName }) {
  const { settings } = useSettings();
  const sync = useSync();
  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Marquee theme={theme} />
        <View style={styles.icons}>
          <Pressable
            onPress={() => router.push('/profile')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.75 }]}
          >
            <Avatar
              theme={theme}
              uri={settings.photo}
              name={settings.name}
              size={36}
              status={sync.status === 'signed-out' || sync.status === 'unconfigured' ? undefined : sync.status}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? theme.chip : 'transparent' }]}
          >
            <Ionicons name="settings-outline" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>
      <View style={styles.lineRow}>
        {icon && <MaterialCommunityIcons name={icon} size={16} color={theme.accent} accessibilityElementsHidden importantForAccessibility="no" />}
        <Text style={[styles.line, { color: theme.textMuted }]}>{line}</Text>
      </View>
    </View>
  );
}

const BULBS = 13;

/**
 * The wordmark on a cinema marquee: a board framed in gold with a row of bulbs above and below that chase
 * slowly, every other bulb in turn. Still when the phone asks for less motion.
 */
function Marquee({ theme }: { theme: Theme }) {
  const reduced = useReducedMotion();
  // One value drives every bulb; kept in state, made once.
  const [phase] = useState(() => new Animated.Value(0));
  const [lit] = useState(() => [phase.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }), phase.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] })]);
  useEffect(() => {
    if (reduced) {
      phase.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(phase, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, reduced]);
  const bulbs = (
    <View style={styles.bulbs}>
      {Array.from({ length: BULBS }, (_, i) => (
        <Animated.View key={i} style={[styles.bulb, { backgroundColor: theme.accent, opacity: lit[i % 2] }]} />
      ))}
    </View>
  );
  return (
    <View style={[styles.board, { borderColor: theme.accent, backgroundColor: theme.dark ? '#000000' : theme.card }]}>
      {bulbs}
      <BrandTitle theme={theme} size={30} />
      {bulbs}
    </View>
  );
}

/** A small picture for the time of day: coffee, popcorn for the matinee, a ticket for the evening show, the moon. */
export function greetingIcon(hour: number): MciName {
  if (hour >= 5 && hour < 12) return 'coffee-outline';
  if (hour >= 12 && hour < 17) return 'popcorn';
  if (hour >= 17 && hour < 22) return 'ticket-outline';
  return 'weather-night';
}

/** A line under the title that changes with the hour, like the next showing on a marquee. */
export function greetingLine(hour: number, name: string) {
  const who = name.trim() ? `, ${name.trim()}` : '';
  if (hour >= 5 && hour < 12) return `Morning${who}. Coffee and a classic?`;
  if (hour >= 12 && hour < 17) return `Afternoon${who}. Matinee time.`;
  if (hour >= 17 && hour < 22) return `Evening${who}. Lights down, phones away.`;
  return `Still up${who}? One more episode…`;
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatarBtn: { padding: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  line: { fontFamily: fonts.mono, fontSize: font.footnote, flexShrink: 1 },
  board: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, gap: 3, flexShrink: 1 },
  bulbs: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  bulb: { width: 4, height: 4, borderRadius: 2 },
});
