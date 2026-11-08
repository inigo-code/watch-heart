import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { discoverTmdb } from '@/api/tmdb';
import { browse } from '@/components/discover/browse';
import { SectionLabel } from '@/components/SectionLabel';
import { AWARD_LISTS } from '@/lib/awards';
import { INDIAN_GEMS, LISTS } from '@/lib/discover';
import type { Shelf } from '@/lib/discover';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/** Discover's lists, Letterboxd-style: a card per theme with its top three posters fanned out; in India, hidden gems first. */
export function CuratedLists({ theme, tmdb, region }: { theme: Theme; tmdb: string; region: string }) {
  const lists = region === 'IN' ? [INDIAN_GEMS, ...LISTS] : LISTS;
  // India's own award first in India.
  const national = AWARD_LISTS.filter((l) => l.id === 'national');
  const awards = region === 'IN' ? [...national, ...AWARD_LISTS.filter((l) => l.id !== 'national')] : AWARD_LISTS;
  return (
    <>
      <Row title="Lists" lists={lists} theme={theme} tmdb={tmdb} />
      <Row title="Award winners" lists={awards} theme={theme} tmdb={tmdb} />
    </>
  );
}

function Row({ title, lists, theme, tmdb }: { title: string; lists: Shelf[]; theme: Theme; tmdb: string }) {
  return (
    <View style={styles.section}>
      <SectionLabel theme={theme}>{title}</SectionLabel>
      <FlatList
        data={lists}
        horizontal
        keyExtractor={(l) => l.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        initialNumToRender={3}
        windowSize={5}
        renderItem={({ item }) => <ListCard list={item} theme={theme} tmdb={tmdb} />}
      />
    </View>
  );
}

function ListCard({ list, theme, tmdb }: { list: Shelf; theme: Theme; tmdb: string }) {
  const [posters, setPosters] = useState<string[] | null>(null);
  useEffect(() => {
    if (!tmdb) return;
    let live = true;
    // A fixed list only needs its first three films for the fan.
    discoverTmdb(tmdb, list.q.ids ? { ...list.q, ids: list.q.ids.slice(0, 3) } : list.q, 1)
      .then((r) => live && setPosters(r.results.flatMap((t) => (t.posterUrl ? [t.posterUrl] : [])).slice(0, 3)))
      .catch(() => live && setPosters([]));
    return () => {
      live = false;
    };
  }, [tmdb, list.q]);
  return (
    <Pressable
      onPress={() => browse(list.q, list.name)}
      accessibilityRole="button"
      accessibilityLabel={`${list.name}: ${list.note}`}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.fan}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.poster,
              { left: i * 34, zIndex: 3 - i, backgroundColor: theme.elevated, borderColor: theme.card, transform: [{ rotate: `${(i - 1) * 4}deg` }] },
            ]}
          >
            {!!posters?.[i] && <Image source={posters[i]} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={150} />}
          </View>
        ))}
      </View>
      <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
        {list.name}
      </Text>
      <Text style={[styles.note, { color: theme.textMuted }]} numberOfLines={2}>
        {list.note}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  row: { gap: 12, paddingRight: 16 },
  card: { width: 168, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 4 },
  fan: { height: 112, marginBottom: 8 },
  poster: { position: 'absolute', top: 4, width: 72, height: 106, borderRadius: 5, borderWidth: 2, overflow: 'hidden' },
  name: { fontSize: font.body, fontWeight: '700', lineHeight: 20 },
  note: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 16 },
});
