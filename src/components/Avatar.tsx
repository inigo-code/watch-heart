import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { SyncStatus } from '@/sync/SyncProvider';

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** The sync dot: green up to date, blue syncing, an amber ring for changes waiting, red a problem; none signed out. */
function dotFor(status: SyncStatus | undefined, theme: Theme): { color: string; ring: boolean } | null {
  if (status === 'synced' || status === 'idle') return { color: '#3CCB7F', ring: false };
  if (status === 'syncing') return { color: '#4C9BFF', ring: false };
  if (status === 'waiting') return { color: '#F2B84B', ring: true };
  if (status === 'error') return { color: theme.danger, ring: false };
  return null;
}

/** Your photo, or your initials on the accent colour, with a small sync dot in the corner (as in Prompt Heart). */
export function Avatar({ theme, uri, name, size = 36, status }: { theme: Theme; uri: string | null; name: string; size?: number; status?: SyncStatus }) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  const letters = initials(name);
  const dot = dotFor(status, theme);
  const d = size * (dot?.ring ? 0.42 : 0.32);
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={uri} style={[box, { backgroundColor: theme.chip }]} contentFit="cover" transition={150} />
      ) : (
        <View style={[box, styles.center, { backgroundColor: letters ? theme.accent : theme.chip }]}>
          {letters ? (
            <Text style={[styles.letters, { color: theme.accentText, fontSize: size * 0.46 }]}>{letters}</Text>
          ) : (
            <Ionicons name="person" size={size * 0.5} color={theme.textMuted} />
          )}
        </View>
      )}
      {dot && (
        <View
          style={[
            styles.dot,
            { width: d, height: d, borderRadius: d / 2, backgroundColor: dot.ring ? theme.bg : dot.color, borderColor: dot.ring ? dot.color : theme.bg },
            dot.ring && styles.ring,
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  letters: { fontFamily: fonts.display, includeFontPadding: false, marginTop: 2 },
  dot: { position: 'absolute', right: -1, bottom: -1, borderWidth: 2 },
  ring: { borderWidth: 3 },
});
