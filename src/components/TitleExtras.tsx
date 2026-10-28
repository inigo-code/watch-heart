import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionLabel } from '@/components/SectionLabel';
import { tmdbKey } from '@/api';
import { omdbKey as omdbKeyFor, omdbRatings, watchRegion } from '@/api/omdb';
import type { OmdbRatings } from '@/api/omdb';
import { extrasTmdb } from '@/api/tmdb';
import type { Provider, TitleExtras as Extras } from '@/api/tmdb';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import type { Source } from '@/store/types';

// Scores and where to watch for one title, fetched when it's opened. Kept for the session, so going
// back and forth doesn't ask again; nothing here is saved with the diary.
const cache = new Map<string, { extras: Extras | null; omdb: OmdbRatings | null }>();

type Props = { source: Source; sourceId: string; imdbId?: string | null; theme: Theme };

export function TitleExtras({ source, sourceId, imdbId, theme }: Props) {
  const { settings } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const region = watchRegion(settings.watchRegion);
  const omdbKey = omdbKeyFor(settings.omdbKey);
  const id = `${source}:${sourceId}:${region}:${omdbKey ? 'o' : ''}`;
  const [fetched, setFetched] = useState<{ id: string; value: { extras: Extras | null; omdb: OmdbRatings | null } } | null>(null);
  const data = cache.get(id) ?? (fetched?.id === id ? fetched.value : null);
  const loading = !data && !cache.has(id);

  useEffect(() => {
    if (cache.has(id)) return;
    const controller = new AbortController();
    (async () => {
      const extras = source === 'tmdb' && key ? await extrasTmdb(key, sourceId, region, controller.signal).catch(() => null) : null;
      const imdb = extras?.imdbId ?? imdbId ?? null;
      const omdb = omdbKey && imdb ? await omdbRatings(omdbKey, imdb, controller.signal).catch(() => null) : null;
      if (controller.signal.aborted) return;
      const value = { extras: extras ? { ...extras, imdbId: imdb } : imdb ? { score: null, votes: 0, imdbId: imdb, watch: null } : null, omdb };
      cache.set(id, value);
      setFetched({ id, value });
    })();
    return () => controller.abort();
  }, [id, source, sourceId, imdbId, key, region, omdbKey]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.accent} />
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
        {e.score !== null && <Score theme={theme} label="TMDB" value={`${e.score}`} sub={`${compact(e.votes)} votes`} />}
        {data?.omdb?.imdb && <Score theme={theme} label="IMDb" value={data.omdb.imdb.rating} sub={`${data.omdb.imdb.votes} votes`} color="#F5C518" onPress={imdbUrl ? () => Linking.openURL(imdbUrl) : undefined} />}
        {data?.omdb?.rottenTomatoes && <Score theme={theme} label="Rotten Tomatoes" value={data.omdb.rottenTomatoes} />}
        {data?.omdb?.metacritic && <Score theme={theme} label="Metacritic" value={data.omdb.metacritic.split('/')[0]} />}
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

function Score({ theme, label, value, sub, color, onPress }: { theme: Theme; label: string; value: string; sub?: string; color?: string; onPress?: () => void }) {
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
      <Text style={[styles.providerKind, { color: theme.text }]}>{title.toUpperCase()}</Text>
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
  loading: { paddingVertical: 12, alignItems: 'flex-start' },
  wrap: { gap: 12 },
  scores: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'stretch' },
  score: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 84 },
  scoreLabel: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1 },
  scoreValue: { fontFamily: fonts.display, fontSize: 28, includeFontPadding: false },
  scoreSub: { fontFamily: fonts.mono, fontSize: 10 },
  imdb: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5C518', borderRadius: 10, paddingHorizontal: 14, alignSelf: 'center', height: 40 },
  imdbText: { fontWeight: '900', fontSize: font.body, color: '#000000' },
  note: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 16 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  providerKind: { fontFamily: fonts.monoBold, fontSize: font.caption, width: 54, letterSpacing: 1 },
  logos: { gap: 8 },
  logo: { width: 40, height: 40, borderRadius: 10 },
  credit: { fontFamily: fonts.mono, fontSize: 10 },
});
