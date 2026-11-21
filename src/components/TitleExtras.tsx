import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Tap } from '@/components/Motion';
import { SectionLabel } from '@/components/SectionLabel';
import { tmdbKey } from '@/api';
import { omdbKey as omdbKeyFor, watchRegion } from '@/api/omdb';
import type { Provider } from '@/api/tmdb';
import { inCountry } from '@/lib/discover';
import { loadTitleScores, scoresId, setScoreDefaults } from '@/lib/titleScores';
import type { TitleScores } from '@/lib/titleScores';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { openOnService } from '@/lib/watchLinks';
import { useSettings } from '@/settings/SettingsProvider';
import type { Source } from '@/store/types';

// Scores and where to watch for one title (lib/titleScores.ts, which starts loading them as soon as a
// poster is touched). Answers that came back are kept here for the session, so a page opens with them.
const cache = new Map<string, TitleScores>();

type Props = {
  source: Source;
  sourceId: string;
  imdbId?: string | null;
  /** For finding the IMDb score by name when TMDB has no IMDb id. */
  title?: string;
  year?: number | null;
  series?: boolean;
  theme: Theme;
};

export function TitleExtras({ source, sourceId, imdbId, title, year, series, theme }: Props) {
  const { settings } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const region = watchRegion(settings.watchRegion);
  const omdbKey = omdbKeyFor(settings.omdbKey);
  const id = scoresId({ source, sourceId }, region, omdbKey);
  const [fetched, setFetched] = useState<{ id: string; value: TitleScores } | null>(null);
  const data = cache.get(id) ?? (fetched?.id === id ? fetched.value : null);
  const loading = !data && !cache.has(id);

  // Touching a poster elsewhere warms the answer with the same settings this page uses.
  useEffect(() => setScoreDefaults(key, omdbKey, region), [key, omdbKey, region]);

  useEffect(() => {
    if (cache.has(id)) return;
    let live = true;
    loadTitleScores({ source, sourceId, imdbId, title, year, series }, key, region, omdbKey)
      .catch(() => ({ extras: null, omdb: null }))
      .then((value) => {
        cache.set(id, value);
        if (live) setFetched({ id, value });
      });
    return () => {
      live = false;
    };
  }, [id, source, sourceId, imdbId, key, region, omdbKey, title, year, series]);

  // While loading, the cards' shapes hold their place, so the page doesn't jump when they arrive.
  if (loading) {
    return (
      <View style={styles.wrap} accessibilityLabel="Loading scores">
        <View style={styles.scores}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.ghost, { backgroundColor: theme.card, borderColor: theme.border }]} />
          ))}
        </View>
        <View style={[styles.ghostLine, { backgroundColor: theme.card }]} />
      </View>
    );
  }
  const e = data?.extras;
  if (!e) return null;
  const w = e.watch;
  const imdbUrl = e.imdbId ? `https://www.imdb.com/title/${e.imdbId}/` : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.scores}>
        {data?.omdb?.imdb && (
          <Score
            theme={theme}
            label="IMDb"
            value={data.omdb.imdb.rating}
            sub={`${data.omdb.imdb.votes} votes`}
            onPress={imdbUrl ? () => Linking.openURL(imdbUrl) : undefined}
          />
        )}
        {data?.omdb?.rottenTomatoes && <Score theme={theme} label="Rotten Tomatoes" value={data.omdb.rottenTomatoes} />}
        {data?.omdb?.metacritic && <Score theme={theme} label="Metacritic" value={data.omdb.metacritic.split('/')[0]} />}
        {/* TMDB's own score whenever IMDb has none yet (new and regional titles), so there's always a score from viewers. */}
        {e.score !== null && !data?.omdb?.imdb && (
          <Score theme={theme} label="TMDB" value={`${e.score}`} sub={`${compact(e.votes)} votes`} />
        )}
        {imdbUrl && !data?.omdb?.imdb && (
          <Pressable onPress={() => Linking.openURL(imdbUrl)} accessibilityRole="link" style={({ pressed }) => [styles.imdb, { opacity: pressed ? 0.8 : 1 }]}>
            <Text style={styles.imdbText}>IMDb</Text>
            <Ionicons name="open-outline" size={14} color="#000000" />
          </Pressable>
        )}
      </View>

      <SectionLabel theme={theme}>Where to watch in {inCountry(region)}</SectionLabel>
      {w && (w.stream.length || w.free.length || w.rent.length || w.buy.length) ? (
        <View style={{ gap: 10 }}>
          <Providers theme={theme} kind="Stream" list={w.stream} title={title ?? ''} page={w.link} />
          <Providers theme={theme} kind="Free" list={w.free} title={title ?? ''} page={w.link} />
          <Providers theme={theme} kind="Rent" list={w.rent} title={title ?? ''} page={w.link} />
          <Providers theme={theme} kind="Buy" list={w.buy} title={title ?? ''} page={w.link} />
          {!!w.link && (
            // TMDB's page for the title links each service straight to it (through JustWatch).
            <Pressable onPress={() => Linking.openURL(w.link!)} accessibilityRole="link" style={styles.exact}>
              <Ionicons name="open-outline" size={14} color={theme.accent} />
              <Text style={[styles.exactText, { color: theme.accent }]}>Exact page on each service</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Text style={[styles.note, { color: theme.textMuted }]}>Not streaming, to rent or to buy in this country right now.</Text>
      )}
      <Text style={[styles.credit, { color: theme.textMuted }]}>Where-to-watch data from JustWatch</Text>
    </View>
  );
}

const compact = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));

function Score({
  theme,
  label,
  value,
  sub,
  onPress,
}: {
  theme: Theme;
  label: string;
  value: string;
  sub?: string;
  onPress?: () => void;
}) {
  // All scores alike, so none reads as the one to trust; one that opens its site says so with the arrow.
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'link' : undefined}
      accessibilityLabel={`${label} ${value}${sub ? `, ${sub}` : ''}`}
      style={({ pressed }) => [styles.score, { backgroundColor: pressed ? theme.chip : theme.card, borderColor: theme.border }]}
    >
      <View style={styles.scoreHead}>
        {/* Two lines, so "Rotten Tomatoes" stays whole at larger text sizes. */}
        <Text style={[styles.scoreLabel, { color: theme.textMuted }]} numberOfLines={2}>
          {label}
        </Text>
        {onPress && <Ionicons name="open-outline" size={12} color={theme.textMuted} />}
      </View>
      <Text style={[styles.scoreValue, { color: theme.text }]}>{value}</Text>
      {sub && <Text style={[styles.scoreSub, { color: theme.textMuted }]}>{sub}</Text>}
    </Pressable>
  );
}

function Providers({ theme, kind, list, title, page }: { theme: Theme; kind: string; list: Provider[]; title: string; page: string | null }) {
  if (!list.length) return null;
  return (
    <View style={styles.providerRow}>
      <Text style={[styles.providerKind, { color: theme.text }]} numberOfLines={1}>
        {kind}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.logos}>
        {list.map((p) => (
          <Tap key={p.id} onPress={() => openOnService(p.name, title, page).catch(() => {})} scale={0.92} accessibilityRole="link" accessibilityLabel={`Find ${title} on ${p.name}`}>
            {p.logo ? <Image source={p.logo} style={styles.logo} /> : <Text style={[styles.note, { color: theme.text }]}>{p.name}</Text>}
          </Tap>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ghost: { width: 104, height: 74, borderRadius: 12, borderWidth: 1 },
  ghostLine: { height: 64, borderRadius: 12, marginTop: 4 },
  wrap: { gap: 12 },
  scores: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'stretch' },
  score: { flexGrow: 1, flexBasis: 96, maxWidth: '50%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  scoreHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scoreLabel: { flexShrink: 1, fontFamily: fonts.uiSemibold, fontSize: 12 },
  scoreValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, includeFontPadding: false },
  scoreSub: { fontFamily: fonts.ui, fontSize: 12 },
  imdb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5C518',
    borderRadius: 10,
    paddingHorizontal: 14,
    alignSelf: 'center',
    height: 40,
  },
  imdbText: { fontWeight: '900', fontSize: font.body, color: '#000000' },
  note: { fontFamily: fonts.ui, fontSize: font.caption, lineHeight: 16 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Wide enough for STREAM in the typewriter face on any phone.
  providerKind: { fontFamily: fonts.uiSemibold, fontSize: font.caption, width: 66 },
  logos: { gap: 8 },
  logo: { width: 40, height: 40, borderRadius: 10 },
  credit: { fontFamily: fonts.ui, fontSize: 12 },
  exact: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  exactText: { fontFamily: fonts.uiSemibold, fontSize: font.caption },
});
