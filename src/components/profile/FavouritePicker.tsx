import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { search, tmdbKey } from '@/api';
import { KeyboardSafe } from '@/components/KeyboardSafe';
import { Poster } from '@/components/Film';
import { KIND_LABEL } from '@/lib/stats';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import type { Favourite } from '@/settings/SettingsProvider';
import type { Entry } from '@/store/types';

/** Pick a favourite: the titles in your diary, best rated first, then anything on TMDB as you search. */
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

  // Anything else, from TMDB: a favourite you watched long before you started a diary.
  const { settings } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const [found, setFound] = useState<{ q: string; favs: Favourite[] } | null>(null);
  useEffect(() => {
    if (!visible || q.length < 2) return;
    let live = true;
    const timer = setTimeout(() => {
      Promise.all([search('movie', q, key), search('tv', q, key)])
        .then(([films, series]) => {
          if (!live) return;
          const inDiary = new Set(titles.map((t) => `${t.fav.source}:${t.fav.sourceId}`));
          const mixed = films.flatMap((f, i) => [f, series[i]]).concat(series.slice(films.length)).filter(Boolean);
          const favs = mixed
            .filter((t) => !inDiary.has(`${t.source}:${t.sourceId}`))
            .slice(0, 20)
            .map((t) => ({ kind: t.kind, source: t.source, sourceId: t.sourceId, title: t.title, year: t.year, posterUrl: t.posterUrl }));
          setFound({ q, favs });
        })
        .catch(() => live && setFound({ q, favs: [] }));
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [visible, q, key, titles]);
  const more = q.length >= 2 && found?.q === q ? found.favs : [];
  type Row = { type: 'diary'; t: (typeof titles)[number] } | { type: 'head' } | { type: 'more'; fav: Favourite };
  const rows: Row[] = [
    ...shown.map((t) => ({ type: 'diary' as const, t })),
    ...(more.length ? [{ type: 'head' as const }, ...more.map((fav) => ({ type: 'more' as const, fav }))] : []),
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardSafe style={[styles.sheet, { backgroundColor: theme.bg, paddingTop: insets.top + 12 }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: theme.text }]}>PICK A FAVOURITE</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={theme.text} />
          </Pressable>
        </View>
        <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your diary, or any film or series"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text }]}
          />
        </View>
        <FlatList
          data={rows}
          keyExtractor={(r, i) => (r.type === 'head' ? 'head' : r.type === 'diary' ? `d:${r.t.fav.source}:${r.t.fav.sourceId}:${r.t.fav.title}` : `m:${r.fav.source}:${r.fav.sourceId}:${i}`)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 10 }}
          ListEmptyComponent={
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {q ? 'Searching…' : 'Type a title to find it, even one you watched long before your diary.'}
            </Text>
          }
          renderItem={({ item }) =>
            item.type === 'head' ? (
              <Text style={[styles.head2, { color: theme.textMuted }]}>NOT IN YOUR DIARY</Text>
            ) : item.type === 'more' ? (
              <Pressable onPress={() => onPick(item.fav)} accessibilityRole="button" style={({ pressed }) => [styles.row, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
                <Poster uri={item.fav.posterUrl} title={item.fav.title} width={42} theme={theme} radius={4} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                    {item.fav.title}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textMuted }]}>{[KIND_LABEL[item.fav.kind], item.fav.year].filter(Boolean).join(' · ')}</Text>
                </View>
              </Pressable>
            ) : (
            <Pressable onPress={() => onPick(item.t.fav)} accessibilityRole="button" style={({ pressed }) => [styles.row, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}>
              <Poster uri={item.t.fav.posterUrl} title={item.t.fav.title} width={42} theme={theme} radius={4} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                  {item.t.fav.title}
                </Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  {[KIND_LABEL[item.t.fav.kind], item.t.fav.year, item.t.rating ? `${'★'.repeat(Math.floor(item.t.rating / 2))}${item.t.rating % 2 ? '½' : ''}` : null, item.t.liked ? '♥' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </Pressable>
            )
          }
        />
      </KeyboardSafe>
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
  head2: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1.5, marginTop: 6 },
});
