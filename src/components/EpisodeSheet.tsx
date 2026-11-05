import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Episode } from '@/api/episodes';
import { Text } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { StarInput } from '@/components/Film';
import { Tap } from '@/components/Motion';
import { SectionLabel } from '@/components/SectionLabel';
import { friendlyDate, today } from '@/lib/dates';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/** One episode: its picture, name, summary and details, and your rating. Rating an unseen episode logs it. */
export function EpisodeSheet({ episode, theme, seen, rating, onRate, onTick, onClose }: {
  episode: Episode | null;
  theme: Theme;
  seen: boolean;
  rating: number;
  onRate: (rating: number) => void;
  onTick: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const e = episode;
  const out = !!e?.airDate && e.airDate <= today();
  const details = e ? [e.airDate ? friendlyDate(e.airDate) : null, e.runtime ? `${e.runtime} min` : null].filter(Boolean).join(' · ') : '';
  return (
    <BottomSheet visible={e !== null} onClose={onClose}>
      {e && (
        <View style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16, maxHeight: height * 0.85 }]}>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {!!e.still && <Image source={e.still} style={[styles.still, { backgroundColor: theme.elevated }]} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />}
            <Text style={[styles.kicker, { color: theme.accent }]}>
              SEASON {e.season} · EPISODE {e.number}
            </Text>
            <Text style={[styles.name, { color: theme.text }]}>{(e.name || `Episode ${e.number}`).toUpperCase()}</Text>
            <View style={styles.meta}>
              {!!details && <Text style={[styles.detail, { color: theme.textMuted }]}>{details}</Text>}
              {!!e.score && (
                <View style={styles.score}>
                  <Ionicons name="star" size={14} color={theme.star} />
                  <Text style={[styles.detail, { color: theme.textMuted }]}>{e.score.toFixed(1)}</Text>
                </View>
              )}
            </View>
            {!!e.director && <Text style={[styles.detail, { color: theme.textMuted }]}>Directed by {e.director}</Text>}
            {!!e.overview && <Text style={[styles.overview, { color: theme.text }]}>{e.overview}</Text>}
            {out && (
              <View style={styles.rate}>
                <SectionLabel theme={theme}>Your rating</SectionLabel>
                <StarInput value={rating} onChange={onRate} theme={theme} size={36} />
              </View>
            )}
            {out && (
              <Tap onPress={onTick} accessibilityRole="button" style={[styles.tick, seen ? { borderColor: theme.border, borderWidth: 1 } : { backgroundColor: theme.accent }]}>
                <Ionicons name={seen ? 'close' : 'checkmark'} size={20} color={seen ? theme.text : theme.accentText} />
                <Text style={[styles.tickText, { color: seen ? theme.text : theme.accentText }]}>{seen ? 'UNTICK' : 'MARK AS WATCHED'}</Text>
              </Tap>
            )}
          </ScrollView>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  body: { padding: 16, gap: 8 },
  still: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: 4 },
  kicker: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  name: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  score: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detail: { fontSize: font.footnote },
  overview: { fontSize: font.body, lineHeight: 23, marginTop: 4 },
  rate: { gap: 8, marginTop: 12 },
  tick: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 25, marginTop: 12 },
  tickText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
});
