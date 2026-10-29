import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListCover } from '@/components/lists/ListCover';
import { SectionLabel } from '@/components/SectionLabel';
import { font, fonts, useTheme } from '@/lib/theme';
import { useLists } from '@/lists/ListsProvider';

/** All your lists, newest change first, and a box to start a new one. */
export default function ListsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { lists, createList } = useLists();
  const [name, setName] = useState('');

  const create = () => {
    if (!name.trim()) return;
    const l = createList(name);
    setName('');
    router.push({ pathname: '/list/[id]', params: { id: l.id } });
  };

  return (
    <FlatList
      style={{ backgroundColor: theme.bg }}
      data={lists}
      keyExtractor={(l) => l.id}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <Text style={[styles.lede, { color: theme.textMuted }]}>
            Your own lists: best of the year, a director ranked, what to show a friend. Share any of them as a story.
          </Text>
          <View style={[styles.newRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="add-circle-outline" size={22} color={theme.accent} />
            <TextInput
              value={name}
              onChangeText={setName}
              onSubmitEditing={create}
              returnKeyType="done"
              placeholder="Name a new list, e.g. Best of 2026"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text }]}
              maxLength={60}
            />
            {!!name.trim() && (
              <Pressable onPress={create} accessibilityRole="button" style={[styles.create, { backgroundColor: theme.accent }]}>
                <Text style={[styles.createText, { color: theme.accentText }]}>CREATE</Text>
              </Pressable>
            )}
          </View>
          {lists.length > 0 && <SectionLabel theme={theme}>{`${lists.length} ${lists.length === 1 ? 'list' : 'lists'}`}</SectionLabel>}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="albums-outline" size={44} color={theme.accent} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>NO LISTS YET</Text>
          <Text style={[styles.lede, { color: theme.textMuted, textAlign: 'center' }]}>Name one above, or open any entry and tap Add to list.</Text>
        </View>
      }
      renderItem={({ item: l }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/list/[id]', params: { id: l.id } })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}
        >
          <ListCover items={l.items} theme={theme} width={112} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
              {l.name}
            </Text>
            {!!l.description && (
              <Text style={[styles.lede, { color: theme.textMuted }]} numberOfLines={2}>
                {l.description}
              </Text>
            )}
            <Text style={[styles.meta, { color: theme.accent }]}>
              {l.items.length} {l.items.length === 1 ? 'TITLE' : 'TITLES'}
              {l.ranked ? ' · RANKED' : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  lede: { fontFamily: fonts.mono, fontSize: font.footnote, lineHeight: 18 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingLeft: 12, paddingRight: 6, minHeight: 52 },
  input: { flex: 1, fontSize: font.body, paddingVertical: 8 },
  create: { height: 38, borderRadius: 19, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  createText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 14, padding: 12 },
  name: { fontFamily: fonts.display, fontSize: font.title2, letterSpacing: 0.5 },
  meta: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 40, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: fonts.display, fontSize: font.largeTitle, letterSpacing: 1 },
});
