import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { BrandTitle } from '@/components/BrandTitle';
import { font } from '@/lib/theme';
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
      <BrandTitle theme={theme} size={font.marquee} />
      <View style={styles.lineRow}>
        <View style={styles.greeting}>
          {icon && (
            <View style={[styles.badge, { backgroundColor: theme.accentSoft }]} accessibilityElementsHidden importantForAccessibility="no">
              <MaterialCommunityIcons name={icon} size={17} color={theme.accent} />
            </View>
          )}
          <Text style={[styles.line, { color: theme.textMuted }]} numberOfLines={1}>
            {line}
          </Text>
        </View>
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
            onPress={() => router.push('/friends')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Friends"
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? theme.chip : 'transparent' }]}
          >
            <Ionicons name="people-outline" size={24} color={theme.text} />
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

/** A few words beside the time-of-day picture, like the next showing on a marquee. Short enough for one line. */
export function greetingLine(hour: number) {
  if (hour >= 5 && hour < 12) return 'Coffee and a film?';
  if (hour >= 12 && hour < 17) return 'Matinee o’clock';
  if (hour >= 17 && hour < 22) return 'Phones on silent';
  return 'Just one more?';
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icons: { flexDirection: 'row', alignItems: 'center' },
  avatarBtn: { paddingHorizontal: 2, paddingVertical: 4 },
  iconBtn: { width: 40, height: 44, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  // A fixed line height with no extra font padding keeps the icon centred on the text on Android.
  line: { fontSize: font.footnote, fontWeight: '600', lineHeight: 18, includeFontPadding: false, flexShrink: 1 },
});
