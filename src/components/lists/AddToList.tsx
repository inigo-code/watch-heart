import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import { useToast } from '@/components/Toast';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useLists } from '@/lists/ListsProvider';
import type { ListItem } from '@/lists/ListsProvider';
import { sameTitle } from '@/store/DiaryStore';

/** Put a title on your lists: tick the lists it belongs on, or start a new one with it. */
export function AddToList({ item, theme, onClose }: { item: ListItem | null; theme: Theme; onClose: () => void }) {
  // The last title stays on the sheet while it slides away.
  const [last, setLast] = useState(item);
  if (item && item !== last) setLast(item);
  return (
    <BottomSheet visible={item !== null} onClose={onClose}>
      {last && <Sheet item={last} theme={theme} onClose={onClose} />}
    </BottomSheet>
  );
}

function Sheet({ item, theme, onClose }: { item: ListItem; theme: Theme; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { lists, createList, addItem, removeItem } = useLists();
  const [name, setName] = useState('');

  const toggle = (id: string) => {
    const l = lists.find((x) => x.id === id);
    if (!l) return;
    const at = l.items.findIndex((x) => sameTitle(x, item));
    if (at >= 0) {
      removeItem(id, at);
      toast(`Taken off “${l.name}”`);
    } else {
      addItem(id, item);
      toast(`Added to “${l.name}”`);
    }
  };
  const create = () => {
    if (!name.trim()) return;
    const l = createList(name);
    addItem(l.id, item);
    toast(`Added to your new list “${l.name}”`);
    setName('');
  };

  return (
    <View style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.grabber, { backgroundColor: theme.border }]} />
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
        ADD “{item.title.toUpperCase()}” TO…
      </Text>
      <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 4 }}>
        {lists.length === 0 && <Text style={[styles.note, { color: theme.textMuted }]}>No lists yet. Name your first one below.</Text>}
        {lists.map((l) => {
          const on = l.items.some((x) => sameTitle(x, item));
          return (
            <Pressable
              key={l.id}
              onPress={() => toggle(l.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.chip : 'transparent' }]}
            >
              <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? theme.accent : theme.textMuted} />
              <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
                {l.name}
              </Text>
              <Text style={[styles.note, { color: theme.textMuted }]}>{l.items.length}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={[styles.newRow, { borderColor: theme.border, backgroundColor: theme.bg }]}>
        <Ionicons name="add" size={20} color={theme.accent} />
        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={create}
          returnKeyType="done"
          placeholder="New list, e.g. Comfort rewatches"
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
      <Pressable onPress={onClose} accessibilityRole="button" style={[styles.done, { backgroundColor: theme.chip }]}>
        <Text style={[styles.doneText, { color: theme.text }]}>DONE</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, gap: 12 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  title: { fontFamily: fonts.display, fontSize: font.title2, letterSpacing: 0.5 },
  note: { fontFamily: fonts.mono, fontSize: font.caption },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderRadius: 10, paddingHorizontal: 8 },
  rowName: { flex: 1, fontSize: font.body, fontWeight: '600' },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingLeft: 12, paddingRight: 6, minHeight: 50 },
  input: { flex: 1, fontSize: font.body, paddingVertical: 8 },
  create: { height: 36, borderRadius: 18, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  createText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  done: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1.5 },
});
