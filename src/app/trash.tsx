import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ActionSheet';
import { Poster } from '@/components/Film';
import { useToast } from '@/components/Toast';
import { friendlyDate } from '@/lib/dates';
import { font, fonts, useTheme } from '@/lib/theme';
import { TRASH_DAYS, useDiary } from '@/store/DiaryStore';
import type { Entry } from '@/store/types';

const DAY = 24 * 60 * 60 * 1000;

export default function TrashScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { trash, restoreEntry, purgeEntry, emptyTrash } = useDiary();
  const [now] = useState(() => Date.now());
  const [confirm, setConfirm] = useState<{ kind: 'one'; entry: Entry } | { kind: 'all' } | null>(null);

  const daysLeft = (e: Entry) => Math.max(0, Math.ceil(((e.deletedAt ?? 0) + TRASH_DAYS * DAY - now) / DAY));

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <Stack.Screen
        options={{
          headerRight: () =>
            trash.length > 0 ? (
              <Pressable onPress={() => setConfirm({ kind: 'all' })} hitSlop={12} accessibilityRole="button" accessibilityLabel="Empty trash">
                <Text style={{ color: theme.danger, fontFamily: fonts.monoBold, fontSize: font.body }}>EMPTY</Text>
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        data={trash}
        keyExtractor={(e) => e.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          trash.length === 0 ? undefined : (
            <Text style={[styles.note, { color: theme.textMuted }]}>Deleted entries wait here for {TRASH_DAYS} days.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Poster uri={item.posterUrl} title={item.title} width={40} theme={theme} radius={3} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>Watched {friendlyDate(item.watchedOn)}</Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>{daysLeft(item)} days left</Text>
            </View>
            <Pressable
              onPress={() => {
                restoreEntry(item.id);
                toast('Restored to your diary');
              }}
              style={[styles.btn, { backgroundColor: theme.accentSoft }]}
              accessibilityLabel={`Restore ${item.title}`}
            >
              <Ionicons name="arrow-undo-outline" size={18} color={theme.text} />
            </Pressable>
            <Pressable
              onPress={() => setConfirm({ kind: 'one', entry: item })}
              style={[styles.btn, { backgroundColor: theme.danger + '1F' }]}
              accessibilityLabel={`Delete ${item.title} forever`}
            >
              <Ionicons name="close" size={18} color={theme.danger} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="trash-outline" size={36} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>TRASH IS EMPTY</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>Entries you delete wait here for {TRASH_DAYS} days, so you can bring them back.</Text>
          </View>
        }
      />

      <ActionSheet
        visible={confirm !== null}
        title={confirm?.kind === 'all' ? `Delete all ${trash.length} entries forever? This can't be undone.` : "Delete forever? This can't be undone."}
        onClose={() => setConfirm(null)}
        actions={[
          {
            label: 'Delete forever',
            icon: 'trash-outline',
            destructive: true,
            onPress: () => (confirm?.kind === 'all' ? emptyTrash() : confirm ? purgeEntry(confirm.entry.id) : undefined),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, gap: 10 },
  note: { fontFamily: fonts.mono, fontSize: font.footnote, marginBottom: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  title: { fontSize: font.body, fontWeight: '700' },
  meta: { fontFamily: fonts.mono, fontSize: font.caption },
  btn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingTop: 96, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 28, letterSpacing: 1 },
  emptyText: { fontFamily: fonts.mono, fontSize: font.body, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
});
