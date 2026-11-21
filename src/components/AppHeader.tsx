import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { BrandTitle } from '@/components/BrandTitle';
import { useFriends } from '@/friends/FriendsProvider';
import { fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useSync } from '@/sync/SyncProvider';

/** The top of Home on one line: the wordmark, then your photo (to your profile), Friends and Settings. */
export function AppHeader({ theme }: { theme: Theme }) {
  const { settings } = useSettings();
  const sync = useSync();
  const { requests } = useFriends();
  return (
    <View style={styles.wrap}>
      <BrandTitle theme={theme} size={30} />
      <View style={styles.icons}>
        <Pressable
          onPress={() => router.push('/friends')}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={requests.length ? `Friends, ${requests.length} waiting` : 'Friends'}
          style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? theme.chip : 'transparent' }]}
        >
          <Ionicons name="people-outline" size={23} color={theme.text} />
          {requests.length > 0 && (
            <View style={[styles.count, { backgroundColor: theme.accent }]}>
              <Text maxFontSizeMultiplier={1} style={[styles.countText, { color: theme.accentText }]}>
                {requests.length > 9 ? '9+' : requests.length}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? theme.chip : 'transparent' }]}
        >
          <Ionicons name="settings-outline" size={22} color={theme.text} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/profile')}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.75 }]}
        >
          <Avatar
            theme={theme}
            uri={settings.photo}
            name={settings.name}
            size={34}
            status={sync.status === 'signed-out' || sync.status === 'unconfigured' ? undefined : sync.status}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 48 },
  icons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 44, height: 48, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarBtn: { width: 48, height: 48, alignItems: 'flex-end', justifyContent: 'center' },
  count: { position: 'absolute', top: 6, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: fonts.uiSemibold, fontSize: 11, lineHeight: 14 },
});
