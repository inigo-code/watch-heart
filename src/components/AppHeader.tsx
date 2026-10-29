import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { BrandTitle } from '@/components/BrandTitle';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useSync } from '@/sync/SyncProvider';

/** The top of Home and the Diary: the marquee title, your photo (to your profile), Settings, and a line below. */
export function AppHeader({ theme, line }: { theme: Theme; line: string }) {
  const { settings } = useSettings();
  const sync = useSync();
  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <BrandTitle theme={theme} size={38} />
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
      <Text style={[styles.line, { color: theme.textMuted }]}>{line}</Text>
    </View>
  );
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
  line: { fontFamily: fonts.mono, fontSize: font.footnote },
});
