import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useMemo, useState } from 'react';
// React Native's Image, not expo-image: see StoryCanvas.
import { Image, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { CardBrand } from '@/components/BrandTitle';
import { admit } from '@/lib/companions';
import { friendlyDate } from '@/lib/dates';
import { fitReview, headingOf } from '@/lib/review';
import { KIND_LABEL } from '@/lib/stats';
import { fonts } from '@/lib/theme';
import { plainProgress } from '@/lib/tracking';
import type { Entry } from '@/store/types';

import { sharp } from './export';
import { PALETTES } from './palettes';
import type { PaletteKey } from './palettes';
import { STORY_H, STORY_W } from './StoryCanvas';
import type { StoryHandle } from './StoryCanvas';

type Props = { entry: Entry; palette: PaletteKey; onReady?: (ready: boolean) => void };

const PAD = 28;
const BODY_W = STORY_W - PAD * 2;

/**
 * A long review as a story: the poster, title and stars small at the top, and the words filling the rest of the
 * card, as large as they fit (src/lib/review.ts fitReview). Too long even at the smallest size, it ends in "…".
 */
export const FullReviewCard = forwardRef<StoryHandle, Props>(function FullReviewCard({ entry, palette, onReady }, ref) {
  const p = PALETTES[palette];
  const [loaded, setLoaded] = useState(!entry.posterUrl);
  // The room the words have, measured, so the size fits whatever the heading and title take.
  const [area, setArea] = useState(0);
  useEffect(() => onReady?.(loaded && area > 0), [loaded, area, onReady]);
  const heading = headingOf(entry);
  const fit = useMemo(() => (area ? fitReview(entry.review, BODY_W, area) : null), [entry.review, area]);
  const meta = [KIND_LABEL[entry.kind].toUpperCase(), entry.year, entry.progress ? plainProgress(entry.progress) : null].filter(Boolean).join(', ');
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (entry.rating >= i * 2) stars.push(<Ionicons key={i} name="star" size={15} color={p.star} />);
    else if (entry.rating === i * 2 - 1) stars.push(<Ionicons key={i} name="star-half" size={15} color={p.star} />);
  }

  return (
    <View ref={ref} collapsable={false} style={styles.canvas}>
      <LinearGradient colors={p.bg} style={StyleSheet.absoluteFill} />
      <View style={styles.inner}>
        <View style={styles.head}>
          <View style={[styles.poster, { backgroundColor: p.card }]}>
            {entry.posterUrl ? (
              <Image
                source={{ uri: sharp(entry.posterUrl, 64) }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                resizeMethod="scale"
                onLoadEnd={() => setLoaded(true)}
                onError={() => setLoaded(true)}
              />
            ) : (
              <View style={styles.noPoster}>
                <Ionicons name="film-outline" size={22} color={p.muted} />
              </View>
            )}
          </View>
          <View style={styles.headText}>
            <Text allowFontScaling={false} style={[styles.kicker, { color: p.accent }]}>{entry.rewatch ? 'REWATCHED' : 'JUST WATCHED'}</Text>
            <Text allowFontScaling={false} style={[styles.title, { color: p.text }]} numberOfLines={2}>
              {entry.title.toUpperCase()}
            </Text>
            <Text allowFontScaling={false} style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
              {meta}
            </Text>
            {(stars.length > 0 || entry.liked) && (
              <View style={styles.rating}>
                {stars}
                {entry.liked && <Ionicons name="heart" size={15} color={p.like} style={{ marginLeft: 4 }} />}
              </View>
            )}
          </View>
        </View>

        <View style={[styles.rule, { borderColor: p.muted + '66' }]} />

        {!!heading && (
          <Text allowFontScaling={false} style={[styles.heading, { color: p.text }]} numberOfLines={3}>
            {heading}
          </Text>
        )}
        <View style={styles.body} onLayout={(e) => setArea(Math.floor(e.nativeEvent.layout.height))}>
          {fit && (
            <Text
              allowFontScaling={false}
              style={[styles.words, { color: p.text, fontSize: fit.size, lineHeight: fit.lineHeight }]}
              numberOfLines={Math.floor(area / fit.lineHeight)}
            >
              {fit.paragraphs.join('\n')}
            </Text>
          )}
        </View>

        <View style={styles.foot}>
          <View style={[styles.stub, { borderColor: p.muted + '66' }]}>
            <Text allowFontScaling={false} style={[styles.stubText, { color: p.muted }]}>{admit(entry.companions?.length ?? 0)}</Text>
            <View style={[styles.stubTear, { borderColor: p.muted + '66' }]} />
            <Text allowFontScaling={false} style={[styles.stubText, { color: p.text }]}>{friendlyDate(entry.watchedOn).toUpperCase()}</Text>
          </View>
          <CardBrand color={p.muted} style={styles.brand} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  canvas: { width: STORY_W, height: STORY_H, overflow: 'hidden' },
  // Instagram covers the top and bottom of a story with its own buttons; the words stay clear of both.
  inner: { flex: 1, paddingTop: 58, paddingBottom: 30, paddingHorizontal: PAD },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  poster: { width: 60, height: 90, borderRadius: 5, overflow: 'hidden', boxShadow: '0 8px 20px rgba(0,0,0,0.45)' },
  noPoster: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, gap: 3 },
  kicker: { fontFamily: fonts.ticketBold, fontSize: 9, letterSpacing: 3 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 27, letterSpacing: 0.5, includeFontPadding: false },
  meta: { fontFamily: fonts.ticketBold, fontSize: 8, letterSpacing: 1.5 },
  rating: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  rule: { borderTopWidth: 1, borderStyle: 'dashed', marginVertical: 16 },
  heading: { fontFamily: fonts.ticketBold, fontSize: 15, lineHeight: 20, marginBottom: 10 },
  body: { flex: 1, overflow: 'hidden' },
  words: { fontFamily: fonts.ticket },
  foot: { alignItems: 'center', paddingTop: 14 },
  stub: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 6, paddingHorizontal: 12, height: 30, gap: 10 },
  stubText: { fontFamily: fonts.ticketBold, fontSize: 9, letterSpacing: 2 },
  stubTear: { alignSelf: 'stretch', borderLeftWidth: 1, borderStyle: 'dashed' },
  brand: { marginTop: 10 },
});
