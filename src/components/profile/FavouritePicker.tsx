import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Poster } from '@/components/Film';
import { KIND_LABEL } from '@/lib/stats';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { Favourite } from '@/settings/SettingsProvider';
import type { Entry } from '@/store/types';

/** Pick a favourite from the titles in your diary, best rated first. */
export function FavouritePicker({ visible, theme, entries, onPick, onClose }: {
  visible: boolean;
  theme: Theme;
  entries: Entry[];
  onPick: (f: Favourite) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  // One row per title, keeping its best rating and a poster if any viewing has one.
  const titles = useMemo(() => {
    const byKey = new Map<string, { fav: Favourite; rating: number; liked: boolean }>();
    for (const e of entries) {
      const key = e.sourceId ? `${e.source}:${e.sourceId}` : `${e.kind}:${e.title.toLowerCase()}`;
      const had = byKey.get(key);
      const fav: Favourite = { kind: e.kind, source: e.source, sourceId: e.sourceId, title: e.title, year: e.year, posterUrl: e.posterUrl ?? had?.fav.posterUrl ?? null };
      if (!had || e.rating > had.rating) byKey.set(key, { fav, rating: Math.max(e.rating, had?.rating ?? 0), liked: e.liked || !!had?.liked });
      else if (e.liked) had.liked = true;
    }
    return [...byKey.values()].sort((a, b) => b.rating - a.rating || Number(b.liked) - Number(a.liked) || a.fav.title.localeCompare(b.fav.title));
  }, [entries]);

  const q = query.trim().toLowerCase();
  const shown = q ? titles.filter((t) => t.fav.title.toLowerCase().includes(q)) : titles;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.sheet, { backgroundColor: theme.bg, paddingTop: insets.top + 12 }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: theme.text }]}>PICK A FAVOURITE</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={theme.text} />
          </Pressable>
        </View>
        <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search your diary" placeholderTextColor={theme.textMuted} style={[styles.input, { color: theme.text }]} />
        </View>
        <FlatList
          data={shown}
          keyExtractor={(t) => `${t.fav.kind}:${t.fav.source}:${t.fav.sourceId}:${t.fav.title}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 10 }}
          ListEmptyComponent={<Text style={[styles.meta, { color: theme.textMuted }]}>Log something first, then pin it here.</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => onPick(item.fav)} accessibilityRole="button" style={({ pressed }) => [styles.row, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
              <Poster uri={item.fav.posterUrl} title={item.fav.title} width={42} theme={theme} radius={4} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                  {item.fav.title}
                </Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  {[KIND_LABEL[item.fav.kind], item.fav.year, item.rating ? `${'★'.repeat(Math.floor(item.rating / 2))}${item.rating % 2 ? '½' : ''}` : null, item.liked ? '♥' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.display, fontSize: font.largeTitle, letterSpacing: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, fontSize: font.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10 },
  name: { fontSize: font.body, fontWeight: '700' },
  meta: { fontFamily: fonts.mono, fontSize: font.caption, marginTop: 2 },
});
