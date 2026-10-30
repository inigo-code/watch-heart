import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useSync } from '@/sync/SyncProvider';

type MciName = keyof typeof MaterialCommunityIcons.glyphMap;

/** The top of Home: the wordmark, your photo (to your profile), Settings, and a line below. */
export function AppHeader({ theme, line, icon }: { theme: Theme; line: string; icon?: MciName }) {
  const { settings } = useSettings();
  const sync = useSync();
  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Wordmark theme={theme} />
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
        {icon && <MaterialCommunityIcons name={icon} size={15} color={theme.accent} accessibilityElementsHidden importantForAccessibility="no" />}
        <Text style={[styles.line, { color: theme.textMuted }]} numberOfLines={1}>
          {line}
        </Text>
      </View>
    </View>
  );
}

const ICON = require('../../assets/icon.png');

/** The wordmark: the app's own icon as a small tile, then WATCH HEART in the marquee face, on one line. */
function Wordmark({ theme }: { theme: Theme }) {
  return (
    <View style={styles.wordmark} accessibilityRole="header" accessibilityLabel="Watch Heart">
      <Image source={ICON} style={styles.icon} />
      <Text style={[styles.word, { color: theme.text }]}>
        WATCH <Text style={{ color: theme.accent }}>HEART</Text>
      </Text>
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
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 18 },
  // A fixed line height with no extra font padding keeps the icon centred on the text on Android.
  line: { fontFamily: fonts.mono, fontSize: font.footnote, lineHeight: 18, includeFontPadding: false, flexShrink: 1 },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  icon: { width: 30, height: 30, borderRadius: 8 },
  word: { fontFamily: fonts.display, fontSize: 29, lineHeight: 32, letterSpacing: 1.2, includeFontPadding: false },
});
