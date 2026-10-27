import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useState } from 'react';
// React Native's Image, not expo-image: see StoryCanvas.
import { Image, StyleSheet, Text, View } from 'react-native';

import { friendlyDate } from '@/lib/dates';
import { KIND_LABEL } from '@/lib/stats';
import { fonts } from '@/lib/theme';
import type { Entry } from '@/store/types';

import { PALETTES } from './palettes';
import type { PaletteKey } from './palettes';
import { STORY_H, STORY_W } from './StoryCanvas';
import type { StoryHandle } from './StoryCanvas';

type Props = { entry: Entry; palette: PaletteKey; showReview: boolean; onReady?: (ready: boolean) => void };

const CREDIT: Record<Entry['kind'], string> = { movie: 'DIRECTED BY', tv: 'ON', anime: 'STUDIO' };

/** One entry as a story: "just watched" with the poster, your stars and a line of your review. */
export const ReviewCard = forwardRef<StoryHandle, Props>(function ReviewCard({ entry, palette, showReview, onReady }, ref) {
  const p = PALETTES[palette];
  const [loaded, setLoaded] = useState(!entry.posterUrl);
  useEffect(() => onReady?.(loaded), [loaded, onReady]);
  const backdrop = entry.backdropUrl ?? entry.posterUrl;
  const review = showReview && !entry.spoilers ? entry.review.replace(/\s+/g, ' ').trim() : '';
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (entry.rating >= i * 2) stars.push(<Ionicons key={i} name="star" size={22} color={p.star} />);
    else if (entry.rating === i * 2 - 1) stars.push(<Ionicons key={i} name="star-half" size={22} color={p.star} />);
  }

  return (
    <View ref={ref} collapsable={false} style={styles.canvas}>
      <LinearGradient colors={p.bg} style={StyleSheet.absoluteFill} />
      {backdrop && (
        <>
          <Image source={{ uri: backdrop }} style={[styles.backdrop, { opacity: 0.6 }]} resizeMode="cover" blurRadius={entry.backdropUrl ? 2 : 20} />
          <LinearGradient colors={['transparent', p.bg[p.bg.length - 1]]} locations={[0.1, 0.95]} style={styles.backdrop} />
        </>
      )}

      <View style={styles.inner}>
        <Text style={[styles.kicker, { color: p.accent }]}>{entry.rewatch ? 'REWATCHED' : 'JUST WATCHED'}</Text>
        <View style={styles.posterWrap}>
          <View style={[styles.poster, { backgroundColor: p.card }]}>
            {entry.posterUrl ? (
              <Image
                source={{ uri: entry.posterUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onLoadEnd={() => setLoaded(true)}
                onError={() => setLoaded(true)}
              />
            ) : (
              <View style={styles.noPoster}>
                <Ionicons name="film-outline" size={40} color={p.muted} />
              </View>
            )}
          </View>
        </View>

        <Text style={[styles.title, { color: p.text }]} numberOfLines={3}>
          {entry.title.toUpperCase()}
        </Text>
        <Text style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
          {[KIND_LABEL[entry.kind].toUpperCase(), entry.year, entry.progress || null].filter(Boolean).join(' · ')}
        </Text>
        {!!entry.credit && (
          <Text style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
            {CREDIT[entry.kind]} <Text style={{ color: p.text }}>{entry.credit.toUpperCase()}</Text>
          </Text>
        )}

        <View style={styles.rating}>
          {stars}
          {entry.liked && <Ionicons name="heart" size={22} color={p.like} style={{ marginLeft: 6 }} />}
        </View>

        {!!review && (
          <Text style={[styles.review, { color: p.text }]} numberOfLines={6}>
            “{review.length > 240 ? `${review.slice(0, 237)}…` : review}”
          </Text>
        )}

        <View style={{ flex: 1 }} />
        <View style={[styles.stub, { borderColor: p.muted + '66' }]}>
          <Text style={[styles.stubText, { color: p.muted }]}>ADMIT ONE</Text>
          <View style={[styles.stubTear, { borderColor: p.muted + '66' }]} />
          <Text style={[styles.stubText, { color: p.text }]}>{friendlyDate(entry.watchedOn).toUpperCase()}</Text>
        </View>
        <View style={styles.brand}>
          <View style={[styles.brandReel, { borderColor: p.accent }]}>
            <Ionicons name="heart" size={8} color={p.accent} />
          </View>
          <Text style={[styles.brandText, { color: p.muted }]}>WATCH HEART</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  canvas: { width: STORY_W, height: STORY_H, overflow: 'hidden' },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, height: STORY_H * 0.55 },
  inner: { flex: 1, paddingTop: 70, paddingBottom: 40, paddingHorizontal: 28, alignItems: 'center', gap: 6 },
  kicker: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 4, marginBottom: 6 },
  posterWrap: { boxShadow: '0 14px 36px rgba(0,0,0,0.65)', borderRadius: 8, marginBottom: 10 },
  poster: { width: 168, height: 252, borderRadius: 8, overflow: 'hidden' },
  noPoster: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 38, lineHeight: 38, textAlign: 'center', letterSpacing: 1, includeFontPadding: false },
  meta: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 1.5, textAlign: 'center' },
  rating: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  review: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 17, textAlign: 'center', fontStyle: 'italic', marginTop: 10 },
  stub: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 6, paddingHorizontal: 12, height: 30, gap: 10 },
  stubText: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 2 },
  stubTear: { alignSelf: 'stretch', borderLeftWidth: 1, borderStyle: 'dashed' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  brandReel: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 2 },
});
