import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tmdbKey } from '@/api';
import { personTmdb } from '@/api/tmdb';
import type { PersonAbout } from '@/api/tmdb';
import { Poster } from '@/components/Film';
import { SectionLabel } from '@/components/SectionLabel';
import { Face, openTitle } from '@/components/title/Rows';
import { font, fonts, useTheme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';

type Filter = 'all' | 'seen' | 'unseen';

/** An actor or filmmaker: who they are, and everything they've been in or made, best known first. */
export default function PersonScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = tmdbKey(useSettings().settings.tmdbKey);
  const { viewingsOf } = useDiary();
  const [person, setPerson] = useState<PersonAbout | null>(null);
  const [failed, setFailed] = useState(false);
  const [bio, setBio] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!key || !id) return;
    const controller = new AbortController();
    personTmdb(key, id, controller.signal)
      .then(setPerson)
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, [key, id]);

  const seenCount = useMemo(() => person?.credits.filter((t) => viewingsOf(t.source, t.sourceId).length > 0).length ?? 0, [person, viewingsOf]);

  if (!person) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        {failed ? <Text style={[styles.meta, { color: theme.textMuted }]}>Couldn’t load this person. Check your connection.</Text> : <ActivityIndicator color={theme.accent} />}
      </View>
    );
  }

  const columns = 3;
  const cell = Math.floor((width - 32 - (columns - 1) * 10) / columns);
  const seen = (t: PersonAbout['credits'][number]) => viewingsOf(t.source, t.sourceId).length > 0;
  const credits = person.credits.filter((t) => (filter === 'all' ? true : filter === 'seen' ? seen(t) : !seen(t)));

  return (
    <FlatList
      style={{ backgroundColor: theme.bg }}
      data={credits}
      numColumns={columns}
      keyExtractor={(t) => t.sourceId}
      columnWrapperStyle={{ gap: 10 }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}
      initialNumToRender={18}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.top}>
            <Face uri={person.photo} name={person.name} theme={theme} size={110} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.name, { color: theme.text }]}>{person.name.toUpperCase()}</Text>
              {!!person.department && <Text style={[styles.dept, { color: theme.accent }]}>{person.department === 'Acting' ? 'ACTOR' : person.department.toUpperCase()}</Text>}
              {!!person.born && (
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  Born {person.born.slice(0, 4)}
                  {person.place ? ` · ${person.place}` : ''}
                </Text>
              )}
              <Text style={[styles.meta, { color: theme.text }]}>
                {seenCount ? `You’ve seen ${seenCount} of ${person.credits.length}` : `${person.credits.length} titles`}
              </Text>
            </View>
          </View>
          {!!person.bio && (
            <Pressable onPress={() => setBio((b) => !b)} accessibilityRole="button">
              <Text style={[styles.bio, { color: theme.text }]} numberOfLines={bio ? undefined : 4}>
                {person.bio}
              </Text>
              {person.bio.length > 240 && <Text style={[styles.more, { color: theme.accent }]}>{bio ? 'SHOW LESS' : 'SHOW MORE'}</Text>}
            </Pressable>
          )}
          <View style={styles.filterRow}>
            <SectionLabel theme={theme} style={{ flex: 1 }}>
              Filmography
            </SectionLabel>
            {seenCount > 0 &&
              (['all', 'seen', 'unseen'] as Filter[]).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: filter === f }}
                  style={[styles.filter, { borderColor: filter === f ? theme.accent : theme.border, backgroundColor: filter === f ? theme.accent : 'transparent' }]}
                >
                  <Text style={[styles.filterText, { color: filter === f ? theme.accentText : theme.text }]}>{f.toUpperCase()}</Text>
                </Pressable>
              ))}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => openTitle(item)}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}${item.year ? `, ${item.year}` : ''}${item.role ? `, ${item.role}` : ''}`}
          style={({ pressed }) => [{ width: cell }, pressed && { opacity: 0.8 }]}
        >
          <View>
            <Poster uri={item.posterUrl} title={item.title} width={cell} theme={theme} radius={6} />
            {seen(item) && (
              <View style={[styles.tick, { backgroundColor: theme.accent }]}>
                <Ionicons name="checkmark" size={13} color={theme.accentText} />
              </View>
            )}
          </View>
          <Text style={[styles.cellTitle, { color: theme.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.cellRole, { color: theme.textMuted }]} numberOfLines={1}>
            {[item.year, item.role].filter(Boolean).join(' · ')}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { gap: 16, marginBottom: 4 },
  top: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  name: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, letterSpacing: 1 },
  dept: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 2 },
  meta: { fontFamily: fonts.mono, fontSize: font.footnote },
  bio: { fontSize: font.body, lineHeight: 22 },
  more: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1, marginTop: 4 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filter: { borderWidth: 1, borderRadius: 14, height: 28, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1 },
  tick: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cellTitle: { fontSize: font.footnote, fontWeight: '700', marginTop: 6, lineHeight: 17 },
  cellRole: { fontFamily: fonts.mono, fontSize: font.caption },
});
