import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tmdbKey } from '@/api';
import { trackable } from '@/api/episodes';
import { BROWSE_GENRES, aboutTmdb, madeBy } from '@/api/tmdb';
import type { TitleAbout } from '@/api/tmdb';
import { Stars } from '@/components/Film';
import { Hero } from '@/components/Hero';
import { AddToList } from '@/components/lists/AddToList';
import { SectionLabel } from '@/components/SectionLabel';
import { TitleExtras } from '@/components/TitleExtras';
import { PeopleRow, RowHead, TitleRow } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { friendlyDate } from '@/lib/dates';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useLists } from '@/lists/ListsProvider';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Title } from '@/store/types';

/**
 * A film or series before (or after) you log it: what it is, who made it, where to watch it, and what
 * to watch next. Opened from search, Discover, recommendations and people's pages.
 */
export default function TitleScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ id: string; t?: string }>();
  const id = params.id;
  const { settings } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const { viewingsOf, onWatchlist, addToWatchlist, removeFromWatchlist } = useDiary();
  const { listsWith } = useLists();
  const seed = useMemo(() => (params.t ? (JSON.parse(params.t) as Title) : null), [params.t]);
  const [about, setAbout] = useState<{ id: string; value: TitleAbout } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [crewTab, setCrewTab] = useState(false);
  const [listing, setListing] = useState(false);
  const [byMaker, setByMaker] = useState<{ id: string; titles: Title[] } | null>(null);
  const a = about?.id === id ? about.value : null;

  useEffect(() => {
    if (!key || !id) return;
    const controller = new AbortController();
    aboutTmdb(key, id, controller.signal)
      .then((value) => setAbout({ id, value }))
      .catch((e) => !controller.signal.aborted && setError(e instanceof Error && e.message !== 'Network request failed' ? e.message : 'No connection.'));
    return () => controller.abort();
  }, [key, id]);

  // The director's (or creator's) other work, once we know who that is.
  const maker = a?.makers[0];
  useEffect(() => {
    if (!key || !maker) return;
    const controller = new AbortController();
    madeBy(key, maker.id, id.startsWith('movie:') ? 'movie' : 'tv', id, controller.signal)
      .then((titles) => setByMaker({ id, titles }))
      .catch(() => {});
    return () => controller.abort();
  }, [key, maker, id]);

  // Search in the Anime tab knows it's anime; TMDB's own details can't always tell (an anime film, say).
  const t: Title | null = a ? { ...a.title, kind: seed?.kind === 'anime' ? 'anime' : a.title.kind, overview: a.overview } : seed;

  if (!t) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Stack.Screen options={{ headerTransparent: false }} />
        {error ? <Text style={[styles.muted, { color: theme.textMuted }]}>{error}</Text> : <ActivityIndicator color={theme.accent} />}
      </View>
    );
  }

  const viewings = viewingsOf(t.source, t.sourceId);
  const saved = onWatchlist(t);
  const onLists = listsWith(t);
  const series = id.startsWith('tv:');
  const seen = (x: Title) => viewingsOf(x.source, x.sourceId).length > 0;
  const people = crewTab ? (a?.crew ?? []) : (a?.cast ?? []);
  const genreIds = BROWSE_GENRES[series ? 'tv' : 'movie'];
  const overview = a?.overview || t.overview || '';

  const log = () => router.push({ pathname: '/log', params: { title: JSON.stringify(t) } });
  const toggleWatchlist = () => {
    if (saved) {
      removeFromWatchlist(saved.id);
      toast('Taken off your watchlist');
    } else {
      addToWatchlist(t);
      toast('Added to your watchlist');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ headerTintColor: '#FFFFFF' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <Hero t={{ ...t, genres: [] }} theme={theme} topInset={insets.top} />

        <View style={styles.body}>
          {t.genres.length > 0 && (
            <View style={styles.genres}>
              {t.genres.map((g) => {
                const genre = genreIds.find((x) => x.name === g);
                return (
                  <Pressable
                    key={g}
                    disabled={!genre}
                    onPress={() =>
                      genre && router.push({ pathname: '/browse', params: { q: JSON.stringify({ kind: t.kind, genres: [genre.id] }), name: g } })
                    }
                    accessibilityRole={genre ? 'button' : undefined}
                    accessibilityLabel={genre ? `Browse ${g}` : g}
                    style={[styles.genre, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.genreText, { color: theme.text }]}>{g}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.mainActions}>
            <Pressable
              onPress={log}
              accessibilityRole="button"
              style={({ pressed }) => [styles.logBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name="add" size={20} color={theme.accentText} />
              <Text style={[styles.logText, { color: theme.accentText }]}>{viewings.length ? 'LOG AGAIN' : 'LOG IT'}</Text>
            </Pressable>
            <Pressable
              onPress={toggleWatchlist}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Take off your watchlist' : 'Add to your watchlist'}
              accessibilityState={{ selected: !!saved }}
              style={({ pressed }) => [
                styles.square,
                { borderColor: saved ? theme.accent : theme.border, backgroundColor: saved ? theme.accent : 'transparent', opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? theme.accentText : theme.text} />
            </Pressable>
          </View>

          <View style={styles.tools}>
            {a?.trailer && <Tool theme={theme} icon="play-circle-outline" label="Trailer" onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${a.trailer}`)} />}
            <Tool theme={theme} icon="albums-outline" label={onLists.length ? `Lists (${onLists.length})` : 'Add to list'} onPress={() => setListing(true)} />
            {trackable(t) && (
              <Tool
                theme={theme}
                icon="list-outline"
                label="Episodes"
                onPress={() => router.push({ pathname: '/track', params: { title: JSON.stringify(t) } })}
              />
            )}
          </View>

          {viewings.length > 0 && (
            <View style={styles.block}>
              <SectionLabel theme={theme}>IN YOUR DIARY · {viewings.length === 1 ? 'SEEN ONCE' : `SEEN ${viewings.length}×`}</SectionLabel>
              {viewings.slice(0, 5).map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => router.push({ pathname: '/entry/[id]', params: { id: v.id } })}
                  accessibilityRole="button"
                  style={[styles.viewing, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                  <Ionicons name="ticket-outline" size={16} color={theme.accent} />
                  <Text style={[styles.viewingDate, { color: theme.text }]}>{v.undated ? 'Date unknown' : friendlyDate(v.watchedOn)}</Text>
                  {v.rating ? <Stars rating={v.rating} size={13} color={theme.star} /> : null}
                  {v.liked && <Ionicons name="heart" size={14} color={theme.like} />}
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </Pressable>
              ))}
            </View>
          )}

          {(!!overview || !!a?.tagline) && (
            <View style={styles.block}>
              {!!a?.tagline && <Text style={[styles.tagline, { color: theme.textMuted }]}>“{a.tagline}”</Text>}
              {!!overview && (
                <Pressable onPress={() => setMore((m) => !m)} accessibilityRole="button" accessibilityHint={more ? 'Shows less' : 'Shows the whole synopsis'}>
                  <Text style={[styles.overview, { color: theme.text }]} numberOfLines={more ? undefined : 4}>
                    {overview}
                  </Text>
                  {overview.length > 220 && <Text style={[styles.showMore, { color: theme.accent }]}>{more ? 'Show less' : 'Show more'}</Text>}
                </Pressable>
              )}
              {series && a && (
                <Text style={[styles.facts, { color: theme.textMuted }]}>
                  {[a.status, a.seasons.length ? `${a.seasons.length} ${a.seasons.length === 1 ? 'season' : 'seasons'}` : null, a.title.episodes ? `${a.title.episodes} episodes` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
            </View>
          )}

          <TitleExtras source={t.source} sourceId={t.sourceId} theme={theme} />

          {a && a.cast.length + a.crew.length > 0 && (
            <View style={styles.block}>
              <RowHead title="Cast & crew" theme={theme} onMore={() => router.push({ pathname: '/credits/[id]', params: { id } })} more="Full list" />
              <View style={styles.tabs}>
                {[
                  { crew: false, label: 'Cast', n: a.cast.length },
                  { crew: true, label: 'Crew', n: a.crew.length },
                ].map((tab) => (
                  <Pressable
                    key={tab.label}
                    disabled={!tab.n}
                    onPress={() => setCrewTab(tab.crew)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: crewTab === tab.crew }}
                    style={[styles.tab, { borderColor: crewTab === tab.crew ? theme.accent : theme.border, backgroundColor: crewTab === tab.crew ? theme.accent : 'transparent', opacity: tab.n ? 1 : 0.4 }]}
                  >
                    <Text style={[styles.tabText, { color: crewTab === tab.crew ? theme.accentText : theme.text }]}>{tab.label.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
              <PeopleRow people={people.slice(0, 15)} theme={theme} />
            </View>
          )}

          {series && a && a.seasons.length > 0 && (
            <View style={styles.block}>
              <RowHead
                title={`Seasons (${a.seasons.length})`}
                theme={theme}
                more="Episodes"
                onMore={trackable(t) ? () => router.push({ pathname: '/track', params: { title: JSON.stringify(t) } }) : undefined}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasons}>
                {a.seasons.map((s) => (
                  <View key={s.n} style={styles.season}>
                    {s.poster ? (
                      <Image source={{ uri: s.poster }} style={[styles.seasonPoster, { backgroundColor: theme.elevated }]} contentFit="cover" />
                    ) : (
                      <View style={[styles.seasonPoster, styles.center, { backgroundColor: theme.elevated }]}>
                        <Text style={[styles.seasonNo, { color: theme.textMuted }]}>{s.n}</Text>
                      </View>
                    )}
                    <Text style={[styles.seasonName, { color: theme.text }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={[styles.seasonSub, { color: theme.textMuted }]}>
                      {s.episodes} eps{s.year ? ` · ${s.year}` : ''}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {a && a.recommendations.length > 0 && (
            <View style={styles.block}>
              <RowHead title="You might like" theme={theme} />
              <TitleRow titles={a.recommendations} theme={theme} seen={seen} />
            </View>
          )}

          {maker && byMaker?.id === id && byMaker.titles.length > 0 && (
            <View style={styles.block}>
              <RowHead
                title={series ? `More from ${maker.name}` : `By the same director`}
                theme={theme}
                more={series ? undefined : maker.name}
                onMore={() => router.push({ pathname: '/person/[id]', params: { id: String(maker.id) } })}
              />
              <TitleRow titles={byMaker.titles} theme={theme} seen={seen} />
            </View>
          )}

          <Text style={[styles.credit, { color: theme.textMuted }]}>Details, cast and recommendations from TMDB.</Text>
        </View>
      </ScrollView>
      <AddToList item={listing ? t : null} theme={theme} onClose={() => setListing(false)} />
    </View>
  );
}

function Tool({ theme, icon, label, onPress }: { theme: Theme; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tool, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={17} color={theme.text} />
      <Text style={[styles.toolText, { color: theme.text }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontFamily: fonts.mono, fontSize: font.body, textAlign: 'center' },
  body: { padding: 16, gap: 22 },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6 },
  genre: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  genreText: { fontSize: font.footnote, fontWeight: '600' },
  mainActions: { flexDirection: 'row', gap: 10 },
  logBtn: { flex: 1, height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logText: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1.5 },
  square: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -10 },
  tool: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12 },
  toolText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  block: { gap: 10 },
  viewing: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 46 },
  viewingDate: { flex: 1, fontFamily: fonts.mono, fontSize: font.body },
  tagline: { fontSize: font.body, fontStyle: 'italic', lineHeight: 21 },
  overview: { fontSize: font.body, lineHeight: 22 },
  showMore: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1, marginTop: 4 },
  facts: { fontFamily: fonts.mono, fontSize: font.footnote },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { borderWidth: 1, borderRadius: 16, height: 32, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1.5 },
  seasons: { gap: 12, paddingRight: 16 },
  season: { width: 96 },
  seasonPoster: { width: 96, height: 144, borderRadius: 6 },
  seasonNo: { fontFamily: fonts.display, fontSize: 40 },
  seasonName: { fontSize: font.footnote, fontWeight: '700', marginTop: 6 },
  seasonSub: { fontFamily: fonts.mono, fontSize: font.caption },
  credit: { fontFamily: fonts.mono, fontSize: font.caption, textAlign: 'center' },
});
