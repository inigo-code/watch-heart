import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
// React Native's Image, not expo-image: see StoryCanvas (captured images must be drawn synchronously).
import { Image, StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/lib/theme';
import type { UserList } from '@/lists/ListsProvider';
import { STORY_H, STORY_W } from '@/story/StoryCanvas';
import type { StoryHandle } from '@/story/StoryCanvas';
import type { Palette } from '@/story/palettes';

/** A list as an Instagram story: a poster wall, or for a ranked list, the top ten as numbered rows. */
export const ListStoryCard = forwardRef<StoryHandle, { list: UserList; palette: Palette; name: string }>(function ListStoryCard(
  { list, palette: p, name },
  ref,
) {
  const ranked = list.ranked;
  const items = list.items.slice(0, ranked ? 10 : 12);
  const more = list.items.length - items.length;
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <LinearGradient colors={p.bg} style={StyleSheet.absoluteFill} />
      <View style={styles.middle}>
        <Text style={[styles.kicker, { color: p.accent }]}>★ {name.trim() ? `${name.trim().toUpperCase()}’S LIST` : 'MY LIST'} ★</Text>
        <Text style={[styles.title, { color: p.text }]} numberOfLines={2} adjustsFontSizeToFit>
          {list.name.toUpperCase()}
        </Text>
        {!!list.description && (
          <Text style={[styles.desc, { color: p.muted }]} numberOfLines={2}>
            {list.description}
          </Text>
        )}
        {ranked ? (
          <View style={styles.rows}>
            {items.map((it, i) => (
              <View key={i} style={[styles.row, { backgroundColor: p.card }]}>
                <Text style={[styles.rank, { color: i < 3 ? p.accent : p.muted }]}>{i + 1}</Text>
                {it.posterUrl ? (
                  <Image source={{ uri: it.posterUrl }} style={styles.thumb} fadeDuration={0} />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: p.strip }]} />
                )}
                <Text style={[styles.rowTitle, { color: p.text }]} numberOfLines={1}>
                  {it.title}
                </Text>
                {!!it.year && <Text style={[styles.rowYear, { color: p.muted }]}>{it.year}</Text>}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.wall}>
            {items.map((it, i) => (
              <View key={i} style={[styles.poster, { backgroundColor: p.card }]}>
                {it.posterUrl ? (
                  <Image source={{ uri: it.posterUrl }} style={StyleSheet.absoluteFill} fadeDuration={0} />
                ) : (
                  <Text style={[styles.posterTitle, { color: p.muted }]}>{it.title}</Text>
                )}
              </View>
            ))}
          </View>
        )}
        <Text style={[styles.count, { color: p.muted }]}>
          {list.items.length} {list.items.length === 1 ? 'TITLE' : 'TITLES'}
          {more > 0 ? ` · ${more} MORE IN THE APP` : ''}
        </Text>
      </View>
      <Text style={[styles.brand, { color: p.accent }]}>♥ WATCH HEART</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: STORY_W, height: STORY_H, overflow: 'hidden', alignItems: 'center', paddingTop: 40, paddingBottom: 56, paddingHorizontal: 20 },
  middle: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 2.5 },
  title: { fontFamily: fonts.display, fontSize: 46, lineHeight: 46, textAlign: 'center', marginTop: 12, alignSelf: 'stretch' },
  desc: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 4 },
  rows: { alignSelf: 'stretch', gap: 5, marginTop: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 6, paddingRight: 10, height: 37, overflow: 'hidden' },
  rank: { fontFamily: fonts.display, fontSize: 22, width: 28, textAlign: 'center' },
  thumb: { width: 24, height: 36 },
  rowTitle: { flex: 1, fontSize: 12, fontWeight: '700' },
  rowYear: { fontFamily: fonts.mono, fontSize: 10 },
  wall: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 18 },
  poster: { width: 74, height: 111, borderRadius: 4, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 4 },
  posterTitle: { fontFamily: fonts.display, fontSize: 12, textAlign: 'center' },
  count: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 1.5, marginTop: 14 },
  brand: { position: 'absolute', bottom: 24, fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 3 },
});
