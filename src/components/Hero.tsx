import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { KindBadge, Poster } from '@/components/Film';
import { formatRuntime } from '@/lib/dates';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { MediaKind } from '@/store/types';

type HeroTitle = {
  kind: MediaKind;
  title: string;
  originalTitle?: string | null;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  runtime: number | null;
  credit?: string | null;
};

const CREDIT_LABEL: Record<MediaKind, string> = { movie: 'DIRECTED BY', tv: 'ON', anime: 'STUDIO' };

/**
 * The top of a title's page: its backdrop fading into the screen like the lights going down, the poster
 * in front, and the title on the marquee.
 */
export function Hero({ t, theme, topInset = 0, children }: { t: HeroTitle; theme: Theme; topInset?: number; children?: ReactNode }) {
  const { width } = useWindowDimensions();
  const backdrop = t.backdropUrl ?? t.posterUrl;
  const height = Math.round(width * 0.56) + topInset;
  // A series' running time is per episode. Anime films (Spirited Away) are logged as anime but run
  // longer than any episode, so they read as a plain running time.
  const perEpisode = t.kind !== 'movie' && !!t.runtime && t.runtime < 70;
  const meta = [t.year, t.runtime ? formatRuntime(t.runtime) + (perEpisode ? ' / ep' : '') : null].filter(Boolean).join(' · ');
  return (
    <View>
      <View style={{ height, backgroundColor: theme.elevated }}>
        {backdrop && <Image source={backdrop} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={250} blurRadius={t.backdropUrl ? 0 : 18} />}
        <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent', theme.bg]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.row}>
        <Poster uri={t.posterUrl} title={t.title} width={110} theme={theme} radius={6} style={[styles.poster, { borderColor: theme.border }]} />
        <View style={styles.info}>
          <KindBadge kind={t.kind} theme={theme} />
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={3}>
            {t.title.toUpperCase()}
          </Text>
          {!!t.originalTitle && (
            <Text style={[styles.original, { color: theme.textMuted }]} numberOfLines={1}>
              {t.originalTitle}
            </Text>
          )}
          {!!meta && <Text style={[styles.meta, { color: theme.textMuted }]}>{meta}</Text>}
          {!!t.credit && (
            <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
              {CREDIT_LABEL[t.kind]} <Text style={{ color: theme.text, fontFamily: fonts.monoBold }}>{t.credit}</Text>
            </Text>
          )}
        </View>
      </View>
      {t.genres.length > 0 && (
        <Text style={[styles.genres, { color: theme.accent }]} numberOfLines={1}>
          {t.genres.slice(0, 4).join('  ·  ').toUpperCase()}
        </Text>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, marginTop: -70, alignItems: 'flex-end' },
  poster: { borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' },
  info: { flex: 1, gap: 4, paddingBottom: 2 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 35, letterSpacing: 0.5, includeFontPadding: false },
  original: { fontFamily: fonts.mono, fontSize: font.footnote },
  meta: { fontFamily: fonts.mono, fontSize: font.caption, letterSpacing: 0.5 },
  genres: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.2, paddingHorizontal: 16, marginTop: 12 },
});
