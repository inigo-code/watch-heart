import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Tap } from '@/components/Motion';
import { SectionLabel } from '@/components/SectionLabel';
import { Face } from '@/components/title/Rows';
import type { Friend } from '@/friends/friendsApi';
import { useFriends } from '@/friends/FriendsProvider';
import { easeNextLayout } from '@/lib/motion';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

const FACE = 64;
const open = (f: Friend) => router.push({ pathname: '/friend/[id]', params: { id: f.id } });

const diaryLine = (f: Friend) => (f.entries ? `${f.entries} in their diary` : f.sharesDiary ? 'Nothing logged yet' : 'Keeps their diary private');

/** Your friends as a row of faces, with Add first. See all opens the full list below it. */
export function FriendsStrip({ theme, adding, onAdd }: { theme: Theme; adding: boolean; onAdd: () => void }) {
  const { friends, photos, loading, error } = useFriends();
  const [expanded, setExpanded] = useState(false);
  const toggle = () => {
    easeNextLayout();
    setExpanded(!expanded);
  };
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <SectionLabel theme={theme}>Your friends{friends.length ? ` (${friends.length})` : ''}</SectionLabel>
        {friends.length > 0 && (
          <Tap onPress={toggle} hitSlop={10} accessibilityRole="button" accessibilityState={{ expanded }} style={styles.more}>
            <Text style={[styles.moreText, { color: theme.textMuted }]}>{expanded ? 'SHOW LESS' : 'SEE ALL'}</Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textMuted} />
          </Tap>
        )}
      </View>
      {error && <Text style={[styles.hint, { color: theme.danger }]}>{error}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Tap onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add a friend" accessibilityState={{ expanded: adding }} style={styles.cell}>
          <View style={[styles.addRing, { borderColor: theme.accent, backgroundColor: adding ? theme.accent : 'transparent' }]}>
            <Ionicons name={adding ? 'close' : 'add'} size={28} color={adding ? theme.accentText : theme.accent} />
          </View>
          <Text style={[styles.faceName, { color: theme.text }]} numberOfLines={1}>
            Add
          </Text>
        </Tap>
        {friends.map((f) => (
          <Tap key={f.id} onPress={() => open(f)} accessibilityRole="button" accessibilityLabel={f.name} style={styles.cell}>
            <Face uri={photos[f.id] ?? null} name={f.name} theme={theme} size={FACE} round />
            <Text style={[styles.faceName, { color: theme.text }]} numberOfLines={1}>
              {f.name.split(/\s+/)[0]}
            </Text>
          </Tap>
        ))}
      </ScrollView>
      {!friends.length && !loading && !error && <Text style={[styles.hint, { color: theme.textMuted }]}>No friends yet. Tap Add to share your code or enter a friend’s.</Text>}
      {expanded &&
        friends.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => open(f)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.friend, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <Face uri={photos[f.id] ?? null} name={f.name} theme={theme} size={46} round />
            <View style={{ flex: 1 }}>
              <Text style={[styles.friendName, { color: theme.text }]} numberOfLines={1}>
                {f.name}
              </Text>
              <Text style={[styles.hint, { color: theme.textMuted }]} numberOfLines={1}>
                {diaryLine(f)}
                {f.bio ? ` · ${f.bio}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moreText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  row: { gap: 14, paddingRight: 8 },
  cell: { width: FACE + 8, alignItems: 'center', gap: 6 },
  addRing: { width: FACE, height: FACE, borderRadius: FACE / 2, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  faceName: { fontSize: font.caption, fontWeight: '600', maxWidth: FACE + 8 },
  hint: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17 },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  friendName: { fontSize: font.body, fontWeight: '700' },
});
