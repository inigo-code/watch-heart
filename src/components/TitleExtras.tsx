import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionLabel } from '@/components/SectionLabel';
import { tmdbKey } from '@/api';
import { omdbKey as omdbKeyFor, watchRegion } from '@/api/omdb';
import type { Provider } from '@/api/tmdb';
import { loadTitleScores, scoresId, setScoreDefaults } from '@/lib/titleScores';
import type { TitleScores } from '@/lib/titleScores';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
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
            color="#F5C518"
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
      {imdbUrl && !omdbKey && <Text style={[styles.note, { color: theme.textMuted }]}>Add a free OMDb key in Settings to see the IMDb rating here.</Text>}

      <SectionLabel theme={theme}>WHERE TO WATCH · {region}</SectionLabel>
      {w && (w.stream.length || w.free.length || w.rent.length || w.buy.length) ? (
        <View style={{ gap: 10 }}>
          <Providers theme={theme} title="Stream" list={w.stream} link={w.link} />
          <Providers theme={theme} title="Free" list={w.free} link={w.link} />
          <Providers theme={theme} title="Rent" list={w.rent} link={w.link} />
          <Providers theme={theme} title="Buy" list={w.buy} link={w.link} />
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
  color,
  onPress,
}: {
  theme: Theme;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.score, { backgroundColor: theme.card, borderColor: color ?? theme.border }]}>
      <Text style={[styles.scoreLabel, { color: color ?? theme.textMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.scoreValue, { color: theme.text }]}>{value}</Text>
      {sub && <Text style={[styles.scoreSub, { color: theme.textMuted }]}>{sub}</Text>}
    </Pressable>
  );
}

function Providers({ theme, title, list, link }: { theme: Theme; title: string; list: Provider[]; link: string | null }) {
  if (!list.length) return null;
  return (
    <View style={styles.providerRow}>
      <Text style={[styles.providerKind, { color: theme.text }]} numberOfLines={1}>
        {title.toUpperCase()}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.logos}>
        {list.map((p) => (
          <Pressable key={p.id} onPress={link ? () => Linking.openURL(link) : undefined} accessibilityRole="link" accessibilityLabel={p.name}>
            {p.logo ? <Image source={p.logo} style={styles.logo} /> : <Text style={[styles.note, { color: theme.text }]}>{p.name}</Text>}
          </Pressable>
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
  score: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 92, maxWidth: 140 },
  scoreLabel: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1 },
  scoreValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, includeFontPadding: false },
  scoreSub: { fontFamily: fonts.mono, fontSize: 10 },
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
  note: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 16 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Wide enough for STREAM in the typewriter face on any phone.
  providerKind: { fontFamily: fonts.monoBold, fontSize: font.caption, width: 66, letterSpacing: 1 },
  logos: { gap: 8 },
  logo: { width: 40, height: 40, borderRadius: 10 },
  credit: { fontFamily: fonts.mono, fontSize: 10 },
});
