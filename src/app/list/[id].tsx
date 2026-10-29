import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ActionSheet';
import { DangerButton } from '@/components/DangerButton';
import { Poster } from '@/components/Film';
import { FavouritePicker } from '@/components/profile/FavouritePicker';
import { SectionLabel } from '@/components/SectionLabel';
import { TitlePicker } from '@/components/TitlePicker';
import { useToast } from '@/components/Toast';
import { KIND_LABEL } from '@/lib/stats';
import { font, fonts, useTheme } from '@/lib/theme';
import { useLists } from '@/lists/ListsProvider';
import type { ListItem } from '@/lists/ListsProvider';
import { sameTitle, useDiary } from '@/store/DiaryStore';

/** One list: its titles in your order (ranked or not), and everything to change it. */
export default function ListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, getList, updateList, deleteList, addItem, removeItem, moveItem } = useLists();
  const { entries, viewingsOf } = useDiary();
  const list = getList(id);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<'diary' | 'search' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (!list) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.bg }]}>
        <Text style={[styles.lede, { color: theme.textMuted }]}>This list is gone.</Text>
      </View>
    );
  }

  const open = (it: ListItem) => {
    const seen = it.sourceId ? viewingsOf(it.source, it.sourceId) : [];
    if (seen[0]) router.push({ pathname: '/entry/[id]', params: { id: seen[0].id } });
    else router.push({ pathname: '/log', params: { title: JSON.stringify({ ...it, backdropUrl: null, genres: [], runtime: null }) } });
  };
  const add = (t: ListItem) => {
    if (list.items.some((x) => sameTitle(x, t))) {
      toast('Already on this list');
      return;
    }
    addItem(list.id, t);
    toast(`Added “${t.title}”`);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'LIST',
          headerRight: () => (
            <Pressable
              onPress={() => setEditing((e) => !e)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={editing ? 'Done editing' : 'Edit list'}
            >
              <Text style={[styles.headerBtn, { color: theme.accent }]}>{editing ? 'DONE' : 'EDIT'}</Text>
            </Pressable>
          ),
        }}
      />
      <FlatList
        style={{ backgroundColor: theme.bg }}
        data={list.items}
        keyExtractor={(it, i) => `${it.source}:${it.sourceId}:${it.title}:${i}`}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            {editing ? (
              <View style={{ gap: 10 }}>
                <TextInput
                  value={list.name}
                  onChangeText={(name) => updateList(list.id, { name })}
                  placeholder="List name"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.nameInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                  maxLength={60}
                />
                <TextInput
                  value={list.description}
                  onChangeText={(description) => updateList(list.id, { description })}
                  placeholder="A line about it (optional)"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.descInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                  maxLength={140}
                  multiline
                />
              </View>
            ) : (
              <View style={{ gap: 4 }}>
                <Text style={[styles.name, { color: theme.text }]}>{list.name.toUpperCase()}</Text>
                {!!list.description && <Text style={[styles.lede, { color: theme.textMuted }]}>{list.description}</Text>}
              </View>
            )}
            <View style={[styles.toggle, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="podium-outline" size={18} color={list.ranked ? theme.accent : theme.textMuted} />
              <Text style={[styles.toggleText, { color: theme.text }]}>Ranked (show 1, 2, 3…)</Text>
              <Switch
                value={list.ranked}
                onValueChange={(ranked) => updateList(list.id, { ranked })}
                trackColor={{ true: theme.accent, false: theme.border }}
                thumbColor="#ffffff"
                accessibilityLabel="Ranked"
              />
            </View>
            <View style={styles.addRow}>
              <AddButton theme={theme} icon="book-outline" label="From your diary" onPress={() => setAdding('diary')} />
              <AddButton theme={theme} icon="search" label="Search all titles" onPress={() => setAdding('search')} />
            </View>
            {list.items.length > 0 && (
              <View style={styles.listHead}>
                <SectionLabel theme={theme}>{`${list.items.length} ${list.items.length === 1 ? 'title' : 'titles'}`}</SectionLabel>
                <Pressable
                  onPress={() => router.push({ pathname: '/list-card/[id]', params: { id: list.id } })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.share, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
                >
                  <Ionicons name="logo-instagram" size={16} color={theme.accentText} />
                  <Text style={[styles.shareText, { color: theme.accentText }]}>STORY</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.lede, { color: theme.textMuted, textAlign: 'center', marginTop: 16 }]}>
            Empty so far. Add titles from your diary or from a search.
          </Text>
        }
        renderItem={({ item, index }) => {
          // While editing, the row holds its own buttons, so it isn't one itself.
          const Row = editing ? View : Pressable;
          return (
            <Row
              {...(editing ? {} : { onPress: () => open(item), accessibilityRole: 'button' as const })}
              style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              {list.ranked && <Text style={[styles.rank, { color: index < 3 ? theme.accent : theme.textMuted }]}>{index + 1}</Text>}
              <Poster uri={item.posterUrl} title={item.title} width={44} theme={theme} radius={4} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>{[KIND_LABEL[item.kind], item.year].filter(Boolean).join(' · ')}</Text>
              </View>
              {editing ? (
                <View style={styles.tools}>
                  <Tool
                    theme={theme}
                    icon="chevron-up"
                    label={`Move ${item.title} up`}
                    disabled={index === 0}
                    onPress={() => moveItem(list.id, index, index - 1)}
                  />
                  <Tool
                    theme={theme}
                    icon="chevron-down"
                    label={`Move ${item.title} down`}
                    disabled={index === list.items.length - 1}
                    onPress={() => moveItem(list.id, index, index + 1)}
                  />
                  <Tool theme={theme} icon="close" label={`Remove ${item.title}`} danger onPress={() => removeItem(list.id, index)} />
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              )}
            </Row>
          );
        }}
        ListFooterComponent={
          editing ? <DangerButton theme={theme} label="Delete this list" onPress={() => setConfirmDelete(true)} style={{ marginTop: 16 }} /> : undefined
        }
      />
      <FavouritePicker
        visible={adding === 'diary'}
        theme={theme}
        entries={entries}
        onClose={() => setAdding(null)}
        onPick={(f) => (add(f as ListItem), setAdding(null))}
      />
      <TitlePicker
        visible={adding === 'search'}
        theme={theme}
        initialQuery=""
        initialKind="movie"
        onClose={() => setAdding(null)}
        onPick={(t) => (add(t), setAdding(null))}
      />
      <ActionSheet
        visible={confirmDelete}
        title={`Delete “${list.name}”? The titles stay in your diary and watchlist; only the list goes.`}
        onClose={() => setConfirmDelete(false)}
        actions={[
          {
            label: 'Delete list',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => {
              deleteList(list.id);
              toast(`Deleted “${list.name}”`);
              router.back();
            },
          },
        ]}
      />
    </>
  );
}

function AddButton({
  theme,
  icon,
  label,
  onPress,
}: {
  theme: ReturnType<typeof useTheme>;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.addBtn, { borderColor: theme.accent + '88', opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={16} color={theme.accent} />
      <Text style={[styles.addText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function Tool({
  theme,
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  theme: ReturnType<typeof useTheme>;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.tool, { backgroundColor: theme.elevated, opacity: disabled ? 0.3 : 1 }]}
    >
      <Ionicons name={icon} size={18} color={danger ? theme.danger : theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 8 },
  headerBtn: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1, paddingHorizontal: 8 },
  name: { fontFamily: fonts.display, fontSize: font.marquee, lineHeight: 46, letterSpacing: 0.5 },
  lede: { fontFamily: fonts.mono, fontSize: font.footnote, lineHeight: 18 },
  nameInput: { fontFamily: fonts.display, fontSize: font.largeTitle, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  descInput: { fontSize: font.body, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 60 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 50 },
  toggleText: { flex: 1, fontSize: font.body, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8 },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addText: { fontSize: font.footnote, fontWeight: '700' },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  share: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 17, paddingHorizontal: 14 },
  shareText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 10 },
  rank: { fontFamily: fonts.display, fontSize: 28, width: 30, textAlign: 'center' },
  itemTitle: { fontSize: font.body, fontWeight: '700' },
  meta: { fontFamily: fonts.mono, fontSize: font.caption, marginTop: 2 },
  tools: { flexDirection: 'row', gap: 6 },
  tool: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
