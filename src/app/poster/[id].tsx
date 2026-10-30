import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tmdbKey } from '@/api';
import { postersTmdb } from '@/api/tmdb';
import { useToast } from '@/components/Toast';
import { font, fonts, useTheme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { choosePosterForDraft } from '@/lib/posterDraft';
import { useDiary } from '@/store/DiaryStore';

const COLUMNS = 3;
const GAP = 10;

/**
 * Personalised posters: every poster TMDB has for a title in your diary. Your pick is used for every
 * viewing of the title, in the Diary, stories and the widget, and refreshes from TMDB keep it.
 */
export default function PosterScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const toast = useToast();
  // An entry's id, or "draft" from the log screen (the title and its poster then come as params, and the
  // choice goes back to the form instead of into the diary).
  const params = useLocalSearchParams<{ id: string; sourceId?: string; title?: string; current?: string; picked?: string }>();
  const id = params.id;
  const draft = id === 'draft';
  const { settings } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const { ready, entries, getEntry, patchMany } = useDiary();
  const entry = draft ? undefined : getEntry(id);
  const subject = draft
    ? { title: params.title ?? '', sourceId: params.sourceId ?? '', posterUrl: params.current || null, posterPick: params.picked || null }
    : entry;
  const sourceId = subject?.sourceId ?? '';
  const [data, setData] = useState<{ for: string; main: string | null; posters: string[]; error: string | null } | null>(null);

  useEffect(() => {
    if (!key || !sourceId) return;
    let live = true;
    postersTmdb(key, sourceId)
      .then((r) => live && setData({ for: sourceId, ...r, error: null }))
      .catch((e) => live && setData({ for: sourceId, main: null, posters: [], error: e instanceof Error ? e.message : 'Couldn’t load the posters.' }));
    return () => {
      live = false;
    };
  }, [key, sourceId]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (!subject) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.note, { color: theme.textMuted }]}>This entry is gone.</Text>
      </View>
    );
  }

  const current = data?.for === sourceId ? data : null;
  // Every viewing of the title wears the same poster.
  const viewings = entry ? entries.filter((e) => e.source === entry.source && e.sourceId === entry.sourceId) : [];
  const choose = (posterUrl: string | null, posterPick: string | null, message: string) => {
    if (draft) {
      choosePosterForDraft({ sourceId, posterUrl, posterPick });
      router.back();
      return;
    }
    patchMany(
      viewings.map((e) => ({ id: e.id, patch: { posterUrl, posterPick } })),
      [],
    );
    toast(message);
    router.back();
  };
  const cell = Math.floor((width - 32 - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <FlatList
      style={{ backgroundColor: theme.bg }}
      data={current?.posters ?? []}
      keyExtractor={(u) => u}
      numColumns={COLUMNS}
      columnWrapperStyle={{ gap: GAP }}
      contentContainerStyle={{ padding: 16, gap: GAP, paddingBottom: insets.bottom + 24 }}
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
            {subject.title.toUpperCase()}
          </Text>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            {draft
              ? 'Used for this entry when you log it, in your diary, stories and the widget.'
              : `${viewings.length === 2 ? 'Used for both viewings, ' : viewings.length > 2 ? `Used for all ${viewings.length} viewings, ` : 'Used '}in your diary, stories and the widget.`}
          </Text>
          {!!subject.posterPick && !!current?.main && (
            <Pressable
              onPress={() => choose(current.main, null, 'Back to TMDB’s poster')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.reset, { borderColor: theme.border, backgroundColor: pressed ? theme.chip : 'transparent' }]}
            >
              <Ionicons name="refresh-outline" size={16} color={theme.text} />
              <Text style={[styles.resetText, { color: theme.text }]}>USE TMDB’S POSTER</Text>
            </Pressable>
          )}
        </View>
      }
      ListEmptyComponent={
        !key ? (
          <Text style={[styles.note, styles.empty, { color: theme.textMuted }]}>Choosing a poster needs TMDB. Add a key in Settings.</Text>
        ) : !current ? (
          <ActivityIndicator color={theme.accent} style={styles.empty} />
        ) : (
          <Text style={[styles.note, styles.empty, { color: current.error ? theme.danger : theme.textMuted }]}>
            {current.error ?? 'TMDB has no other posters for this title.'}
          </Text>
        )
      }
      renderItem={({ item, index }) => {
        const on = item === subject.posterUrl;
        return (
          <Pressable
            onPress={() => (on ? router.back() : choose(item, item === current?.main ? null : item, 'Poster changed'))}
            accessibilityRole="button"
            accessibilityLabel={`Poster ${index + 1}${on ? ', in use' : ''}`}
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [{ width: cell }, pressed && { opacity: 0.8 }]}
          >
            <Image
              source={item}
              recyclingKey={item}
              style={[styles.poster, { width: cell, height: cell * 1.5, backgroundColor: theme.card, borderColor: on ? theme.accent : 'transparent' }]}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
            {on && (
              <View style={[styles.tick, { backgroundColor: theme.accent }]}>
                <Ionicons name="checkmark" size={14} color={theme.accentText} />
              </View>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  head: { gap: 6, marginBottom: 6 },
  title: { fontFamily: fonts.display, fontSize: 28, letterSpacing: 0.5 },
  note: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17 },
  empty: { textAlign: 'center', paddingVertical: 32 },
  reset: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, marginTop: 6 },
  resetText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1.2 },
  poster: { borderRadius: 6, borderWidth: 2 },
  tick: { position: 'absolute', right: 6, top: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
