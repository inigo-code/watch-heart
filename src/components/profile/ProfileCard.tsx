import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
// React Native's Image, not expo-image: see StoryCanvas (captured images must be drawn synchronously).
import { Image, StyleSheet, Text, View } from 'react-native';

import type { ProfileStats } from '@/lib/profileStats';
import { fonts } from '@/lib/theme';
import type { Favourite } from '@/settings/SettingsProvider';
import { sharp } from '@/story/export';
import { STORY_H, STORY_W } from '@/story/StoryCanvas';
import type { StoryHandle } from '@/story/StoryCanvas';
import type { Palette } from '@/story/palettes';

type Props = { name: string; bio: string; photo: string | null; favourites: Favourite[]; stats: ProfileStats; palette: Palette; year: string };

/** The profile as an Instagram story: photo, name, favourite four and the numbers. */
export const ProfileCard = forwardRef<StoryHandle, Props>(function ProfileCard({ name, bio, photo, favourites, stats, palette: p, year }, ref) {
  const numbers = [
    { value: stats.titles.movie, label: 'FILMS' },
    { value: stats.titles.tv, label: 'SERIES' },
    { value: stats.titles.anime, label: 'ANIME' },
    { value: stats.hours, label: 'HOURS' },
  ];
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <LinearGradient colors={p.bg} style={StyleSheet.absoluteFill} />
      <Text style={[styles.kicker, { color: p.accent }]}>★ MY WATCH DIARY ★</Text>
      <View style={[styles.photoRing, { borderColor: p.accent }]}>
        {photo ? <Image source={{ uri: photo }} style={styles.photo} fadeDuration={0} resizeMethod="scale" /> : <Text style={[styles.initial, { color: p.text }]}>{(name.trim()[0] ?? '♥').toUpperCase()}</Text>}
      </View>
      <Text style={[styles.name, { color: p.text }]} numberOfLines={1}>
        {(name.trim() || 'Watch Heart').toUpperCase()}
      </Text>
      {!!bio.trim() && (
        <Text style={[styles.bio, { color: p.muted }]} numberOfLines={2}>
          {bio.trim()}
        </Text>
      )}

      <View style={[styles.strip, { backgroundColor: p.strip }]}>
        <View style={styles.holes}>
          {Array.from({ length: 16 }, (_, i) => (
            <View key={i} style={[styles.hole, { backgroundColor: p.bg[0] }]} />
          ))}
        </View>
        <View style={styles.favs}>
          {Array.from({ length: 4 }, (_, i) => favourites[i]).map((f, i) => (
            <View key={i} style={[styles.poster, { backgroundColor: p.card }]}>
              {f?.posterUrl ? <Image source={{ uri: sharp(f.posterUrl, 64) }} style={StyleSheet.absoluteFill} fadeDuration={0} resizeMethod="scale" /> : f ? <Text style={[styles.posterTitle, { color: p.muted }]}>{f.title}</Text> : null}
            </View>
          ))}
        </View>
        <View style={styles.holes}>
          {Array.from({ length: 16 }, (_, i) => (
            <View key={i} style={[styles.hole, { backgroundColor: p.bg[0] }]} />
          ))}
        </View>
      </View>
      <Text style={[styles.caption, { color: p.muted }]}>FAVOURITE FOUR</Text>

      <View style={styles.numbers}>
        {numbers.map((n) => (
          <View key={n.label} style={styles.number}>
            <Text style={[styles.value, { color: p.text }]}>{n.value}</Text>
            <Text style={[styles.label, { color: p.muted }]}>{n.label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.line, { color: p.muted }]}>
        {stats.thisYear} IN {year} · {stats.longestStreak}-DAY BEST STREAK{stats.avgStars ? ` · ${stats.avgStars}★ AVG` : ''}
      </Text>
      <View style={{ flex: 1 }} />
      <Text style={[styles.brand, { color: p.accent }]}>♥ WATCH HEART</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  // Instagram covers about 58 points at the top and 64 at the bottom with its own buttons.
  card: { width: STORY_W, height: STORY_H, overflow: 'hidden', alignItems: 'center', paddingTop: 58, paddingBottom: 70, paddingHorizontal: 22 },
  kicker: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 3 },
  photoRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, marginTop: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  initial: { fontFamily: fonts.display, fontSize: 50 },
  name: { fontFamily: fonts.display, fontSize: 40, letterSpacing: 1, marginTop: 10 },
  bio: { fontFamily: fonts.mono, fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 2 },
  strip: { alignSelf: 'stretch', marginHorizontal: -22, marginTop: 18, paddingVertical: 6 },
  holes: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  hole: { width: 12, height: 8, borderRadius: 2 },
  favs: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  poster: { width: 64, height: 96, borderRadius: 4, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 4 },
  posterTitle: { fontFamily: fonts.display, fontSize: 12, textAlign: 'center' },
  caption: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 3, marginTop: 8 },
  numbers: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', marginTop: 18 },
  number: { alignItems: 'center', flex: 1 },
  value: { fontFamily: fonts.display, fontSize: 36 },
  label: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 1.5 },
  line: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 1, marginTop: 12, textAlign: 'center' },
  brand: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 3, marginTop: 10 },
});
