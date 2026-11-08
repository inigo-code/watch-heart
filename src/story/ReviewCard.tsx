import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useState } from 'react';
// React Native's Image, not expo-image: see StoryCanvas.
import { Image, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { CardBrand } from '@/components/BrandTitle';
import { admit, namesLine } from '@/lib/companions';
import { friendlyDate } from '@/lib/dates';
import { plainText } from '@/lib/richText';
import { KIND_LABEL } from '@/lib/stats';
import { fonts } from '@/lib/theme';
import type { Entry } from '@/store/types';

import { sharp } from './export';
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
  const review = showReview && !entry.spoilers ? plainText(entry.review).replace(/\s+/g, ' ').trim() : '';
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
          <Image source={{ uri: sharp(backdrop, 360) }} style={[styles.backdrop, { opacity: 0.6 }]} resizeMode="cover" resizeMethod="scale" blurRadius={entry.backdropUrl ? 2 : 20} />
          <LinearGradient colors={['transparent', p.bg[p.bg.length - 1]]} locations={[0.1, 0.95]} style={styles.backdrop} />
        </>
      )}

      <View style={styles.inner}>
        <Text allowFontScaling={false} style={[styles.kicker, { color: p.accent }]}>{entry.rewatch ? 'REWATCHED' : 'JUST WATCHED'}</Text>
        <View style={styles.posterWrap}>
          <View style={[styles.poster, { backgroundColor: p.card }]}>
            {entry.posterUrl ? (
              <Image
                source={{ uri: sharp(entry.posterUrl, 168) }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                resizeMethod="scale"
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

        <Text allowFontScaling={false} style={[styles.title, { color: p.text }]} numberOfLines={3}>
          {entry.title.toUpperCase()}
        </Text>
        <Text allowFontScaling={false} style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
          {[KIND_LABEL[entry.kind].toUpperCase(), entry.year, entry.progress || null].filter(Boolean).join(' · ')}
        </Text>
        {!!entry.credit && (
          <Text allowFontScaling={false} style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
            {CREDIT[entry.kind]} <Text allowFontScaling={false} style={{ color: p.text }}>{entry.credit.toUpperCase()}</Text>
          </Text>
        )}
        {!!entry.companions?.length && (
          <Text allowFontScaling={false} style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
            WITH <Text allowFontScaling={false} style={{ color: p.text }}>{namesLine(entry.companions).toUpperCase()}</Text>
          </Text>
        )}

        <View style={styles.rating}>
          {stars}
          {entry.liked && <Ionicons name="heart" size={22} color={p.like} style={{ marginLeft: 6 }} />}
        </View>

        {!!review && (
          <Text allowFontScaling={false} style={[styles.review, { color: p.text }]} numberOfLines={6}>
            “{review.length > 240 ? `${review.slice(0, 237)}…` : review}”
          </Text>
        )}

        <View style={styles.spacer} />
        <View style={[styles.stub, { borderColor: p.muted + '66' }]}>
          <Text allowFontScaling={false} style={[styles.stubText, { color: p.muted }]}>{admit(entry.companions?.length ?? 0)}</Text>
          <View style={[styles.stubTear, { borderColor: p.muted + '66' }]} />
          <Text allowFontScaling={false} style={[styles.stubText, { color: p.text }]}>{friendlyDate(entry.watchedOn).toUpperCase()}</Text>
        </View>
        <CardBrand color={p.muted} style={styles.brand} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  canvas: { width: STORY_W, height: STORY_H, overflow: 'hidden' },
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, height: STORY_H * 0.55 },
  inner: { flex: 1, paddingTop: 56, paddingBottom: 32, paddingHorizontal: 28, alignItems: 'center', gap: 6 },
  kicker: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 4, marginBottom: 6 },
  // The poster gives up height first, so a long title, credits and review never push the stub and the
  // Watch Heart mark off the bottom of the card.
  posterWrap: { flexBasis: 252, flexShrink: 1, minHeight: 120, aspectRatio: 2 / 3, boxShadow: '0 14px 36px rgba(0,0,0,0.65)', borderRadius: 8, marginBottom: 10 },
  poster: { width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden' },
  noPoster: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 38, lineHeight: 38, textAlign: 'center', letterSpacing: 1, includeFontPadding: false },
  meta: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 1.5, textAlign: 'center' },
  rating: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  review: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 17, textAlign: 'center', fontStyle: 'italic', marginTop: 10 },
  spacer: { flexGrow: 1 },
  stub: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 6, paddingHorizontal: 12, height: 30, gap: 10 },
  stubText: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 2 },
  stubTear: { alignSelf: 'stretch', borderLeftWidth: 1, borderStyle: 'dashed' },
  brand: { marginTop: 10 },
});
