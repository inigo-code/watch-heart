import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { search, tmdbKey } from '@/api';
import { Chip, Poster } from '@/components/Film';
import { KIND_LABEL } from '@/lib/stats';
import { KIND_COLORS, font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import type { MediaKind, Title } from '@/store/types';

/** Find the right title for an entry: search films, series or anime and pick one. */
export function TitlePicker(props: {
  visible: boolean;
  theme: Theme;
  initialQuery: string;
  initialKind: MediaKind;
  onPick: (t: Title) => void;
  onClose: () => void;
}) {
  // Built fresh each time it opens, so it starts from the entry's current title and kind.
  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose} statusBarTranslucent>
      {props.visible && <PickerBody {...props} />}
    </Modal>
  );
}

function PickerBody({ theme, initialQuery, initialKind, onPick, onClose }: { theme: Theme; initialQuery: string; initialKind: MediaKind; onPick: (t: Title) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const [query, setQuery] = useState(initialQuery);
  const [kind, setKind] = useState<MediaKind>(initialKind);
  const [results, setResults] = useState<Title[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      search(kind, query.trim(), key, controller.signal)
        .then((r) => !controller.signal.aborted && setResults(r))
        .catch(() => !controller.signal.aborted && setResults([]))
        .finally(() => !controller.signal.aborted && setLoading(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, kind, key]);
  const shown = query.trim() ? results : [];

  return (
      <View style={[styles.sheet, { backgroundColor: theme.bg, paddingTop: insets.top + 12 }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: theme.text }]}>FIND THE RIGHT TITLE</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={theme.text} />
          </Pressable>
        </View>
        <Text style={[styles.note, { color: theme.textMuted }]}>Your date, rating, review and tags stay. The poster and details come from the title you pick.</Text>
        <View style={styles.kinds}>
          {(['movie', 'tv', 'anime'] as MediaKind[]).map((k) => (
            <Chip key={k} theme={theme} label={KIND_LABEL[k]} color={KIND_COLORS[k]} active={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Title"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text }]}
            autoFocus
            returnKeyType="search"
          />
          {loading && <ActivityIndicator color={theme.accent} />}
        </View>
        <FlatList
          data={shown}
          keyExtractor={(t) => `${t.source}:${t.sourceId}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 10 }}
          ListEmptyComponent={
            !loading && query.trim() ? <Text style={[styles.note, { color: theme.textMuted, marginTop: 12 }]}>Nothing found. Try another kind or spelling.</Text> : undefined
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onPick(item)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <Poster uri={item.posterUrl} title={item.title} width={46} theme={theme} radius={4} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  {[KIND_LABEL[item.kind], item.year, item.originalTitle].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Ionicons name="checkmark-circle-outline" size={22} color={theme.accent} />
            </Pressable>
          )}
        />
      </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.display, fontSize: font.largeTitle, letterSpacing: 1 },
  note: { fontFamily: fonts.mono, fontSize: font.footnote, lineHeight: 18 },
  kinds: { flexDirection: 'row', gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  input: { flex: 1, fontSize: font.body },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 10 },
  name: { fontSize: font.body, fontWeight: '700' },
  meta: { fontFamily: fonts.mono, fontSize: font.caption, marginTop: 2 },
});
