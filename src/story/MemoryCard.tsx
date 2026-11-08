import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useState } from 'react';
// React Native's Image, not expo-image: see StoryCanvas.
import { Image, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { CardBrand } from '@/components/BrandTitle';
import { admit, namesLine } from '@/lib/companions';
import { friendlyDate } from '@/lib/dates';
import { DEVICES } from '@/lib/viewing';
import { fonts } from '@/lib/theme';
import type { Entry } from '@/store/types';

import { sharp } from './export';
import { PALETTES } from './palettes';
import type { PaletteKey } from './palettes';
import { STORY_H, STORY_W } from './StoryCanvas';
import type { StoryHandle } from './StoryCanvas';

/** Where the little poster sits on the photo, or off, so it never has to cover a face. */
export type PosterSpot = 'br' | 'bl' | 'tr' | 'tl' | 'off';

type Props = {
  entry: Entry;
  photo: string | null;
  palette: PaletteKey;
  /** Your own top line; empty uses the default (see memoryKicker). */
  kicker?: string;
  /** A line of your own under the title. */
  caption?: string;
  poster?: PosterSpot;
  onReady?: (ready: boolean) => void;
};

/** The top line unless you write your own: where you watched it, never a time of day it might not have been. */
export function memoryKicker(entry: Entry) {
  if (entry.device === 'cinema') return 'AT THE CINEMA';
  const where = DEVICES.find((d) => d.key === entry.device)?.phrase;
  return where ? where.toUpperCase() : 'A MEMORY';
}

const SPOTS = {
  br: { right: 10, bottom: 10, transform: [{ rotate: '4deg' }] },
  bl: { left: 10, bottom: 10, transform: [{ rotate: '-4deg' }] },
  tr: { right: 10, top: 10, transform: [{ rotate: '-4deg' }] },
  tl: { left: 10, top: 10, transform: [{ rotate: '4deg' }] },
} as const;

const HOLES = 11;

/** A strip of sprocket holes, for the top and bottom of the frame. */
function Sprockets({ color }: { color: string }) {
  return (
    <View style={styles.sprockets}>
      {Array.from({ length: HOLES }, (_, i) => (
        <View key={i} style={[styles.hole, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

/**
 * A memory: your own photo from the night (the cinema, the people you went with) in a film frame, with the
 * title, who was there, the date and your stars on a ticket stub. The photo only lives in the story.
 */
export const MemoryCard = forwardRef<StoryHandle, Props>(function MemoryCard({ entry, photo, palette, kicker: own, caption, poster = 'br', onReady }, ref) {
  const p = PALETTES[palette];
  // The photo that has finished drawing; a new pick isn't ready until it has too.
  const [drawn, setDrawn] = useState<string | null>(null);
  const photoLoaded = !!photo && drawn === photo;
  const spot = entry.posterUrl && poster !== 'off' ? poster : null;
  const [posterLoaded, setPosterLoaded] = useState(false);
  const posterReady = !spot || posterLoaded;
  useEffect(() => onReady?.(photoLoaded && posterReady), [photoLoaded, posterReady, onReady]);

  const kicker = (own?.trim() || memoryKicker(entry)).toUpperCase().replace(/\s+/g, ' ');
  const line = caption?.trim().replace(/\s+/g, ' ') ?? '';
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (entry.rating >= i * 2) stars.push(<Ionicons key={i} name="star" size={16} color={p.star} />);
    else if (entry.rating === i * 2 - 1) stars.push(<Ionicons key={i} name="star-half" size={16} color={p.star} />);
  }

  return (
    <View ref={ref} collapsable={false} style={styles.canvas}>
      <LinearGradient colors={p.bg} style={StyleSheet.absoluteFill} />
      <View style={styles.inner}>
        <Text allowFontScaling={false} style={[styles.kicker, { color: p.accent }]}>
          ★ {kicker} ★
        </Text>

        <View style={[styles.frame, { backgroundColor: p.strip, borderColor: p.muted + '55' }]}>
          <Sprockets color={p.bg[0]} />
          <View style={[styles.photo, { backgroundColor: p.card }]}>
            {photo ? (
              <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" onLoadEnd={() => setDrawn(photo)} onError={() => setDrawn(photo)} />
            ) : (
              <View style={styles.empty}>
                <Ionicons name="image-outline" size={40} color={p.muted} />
                <Text allowFontScaling={false} style={[styles.emptyText, { color: p.muted }]}>
                  YOUR PHOTO HERE
                </Text>
              </View>
            )}
            {spot && entry.posterUrl && (
              <View style={[styles.poster, SPOTS[spot], { borderColor: p.strip }]}>
                <Image
                  source={{ uri: sharp(entry.posterUrl, 56) }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  resizeMethod="scale"
                  onLoadEnd={() => setPosterLoaded(true)}
                  onError={() => setPosterLoaded(true)}
                />
              </View>
            )}
          </View>
          <Sprockets color={p.bg[0]} />
        </View>

        <Text allowFontScaling={false} style={[styles.title, { color: p.text }]} numberOfLines={2}>
          {entry.title.toUpperCase()}
        </Text>
        {!!line && (
          <Text allowFontScaling={false} style={[styles.caption, { color: p.text }]} numberOfLines={3}>
            “{line}”
          </Text>
        )}
        {!!entry.companions?.length && (
          <Text allowFontScaling={false} style={[styles.meta, { color: p.muted }]} numberOfLines={2}>
            WITH <Text allowFontScaling={false} style={{ color: p.text }}>{namesLine(entry.companions).toUpperCase()}</Text>
          </Text>
        )}
        {(stars.length > 0 || entry.liked) && (
          <View style={styles.rating}>
            {stars}
            {entry.liked && <Ionicons name="heart" size={16} color={p.like} style={{ marginLeft: 4 }} />}
          </View>
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
  inner: { flex: 1, paddingTop: 48, paddingBottom: 32, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  kicker: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 3, marginBottom: 4 },
  // The frame gives up height first, so a long title or many names never push the stub off the card.
  frame: { alignSelf: 'stretch', flexShrink: 1, borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, gap: 6, transform: [{ rotate: '-1.5deg' }], boxShadow: '0 16px 36px rgba(0,0,0,0.6)' },
  sprockets: { flexDirection: 'row', justifyContent: 'space-between' },
  hole: { width: 12, height: 8, borderRadius: 2 },
  photo: { flexBasis: 360, flexShrink: 1, minHeight: 200, borderRadius: 3, overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 2 },
  poster: { position: 'absolute', width: 56, height: 84, borderRadius: 4, borderWidth: 2, overflow: 'hidden' },
  caption: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 16, textAlign: 'center', fontStyle: 'italic' },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 33, textAlign: 'center', letterSpacing: 1, includeFontPadding: false, marginTop: 10 },
  meta: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 1.5, textAlign: 'center' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  spacer: { flexGrow: 1 },
  stub: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 6, paddingHorizontal: 12, height: 30, gap: 10 },
  stubText: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 2 },
  stubTear: { alignSelf: 'stretch', borderLeftWidth: 1, borderStyle: 'dashed' },
  brand: { marginTop: 6 },
});
