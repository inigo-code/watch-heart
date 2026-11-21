import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { Tap } from '@/components/Motion';
import { usePullRefresh } from '@/components/PullRefresh';
import { tmdbKey } from '@/api';
import { watchRegion } from '@/api/omdb';
import { refreshAnswers } from '@/api/cache';
import { inCinemasQuery, nowPlayingTmdb } from '@/api/tmdb';
import { AppHeader } from '@/components/AppHeader';
import { Poster } from '@/components/Film';
import { FriendsRow } from '@/components/home/FriendsRow';
import { NotifyInvite } from '@/components/home/NotifyInvite';
import { OfflineNote } from '@/components/home/OfflineNote';
import { WeekStrip } from '@/components/home/WeekStrip';
import { RegionalRows } from '@/components/home/RegionalRows';
import { browse } from '@/components/discover/browse';
import { MovieNightCard, useMovieNights } from '@/components/MovieNight';
import { RowHead, TitleRow } from '@/components/title/Rows';
import { today } from '@/lib/dates';
import { inCountry } from '@/lib/discover';
import { isOffline } from '@/lib/errors';
import { useNudges } from '@/lib/useNudges';
import { homeLanguage } from '@/lib/regional';
import { favouriteSeeds, forYou } from '@/lib/home';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { continueWatching, nextUp } from '@/lib/tracking';
import { useSettings } from '@/settings/SettingsProvider';
import { titleOf, useDiary } from '@/store/DiaryStore';
import { useSync } from '@/sync/SyncProvider';
import { useFriends } from '@/friends/FriendsProvider';
import type { Title } from '@/store/types';

/**
 * Home: your diary first (this week, what you're watching, friends, your watchlist), then a few ways to
 * something new: picks from what you loved, what's in cinemas where you are, and new releases from there.
 * Trending and everything else to browse live in Find.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const region = watchRegion(settings.watchRegion);
  const { entries, watchlist, viewingsOf } = useDiary();
  const { nights } = useMovieNights();
  const [cinema, setCinema] = useState<{ region: string; titles: Title[] } | null>(null);
  const [picks, setPicks] = useState<{ seeds: string; titles: Title[] } | null>(null);
  const lang = homeLanguage(region, settings.homeLanguage);
  // Each pull to refresh asks everything again.
  const [round, setRound] = useState(0);
  const friends = useFriends();
  const sync = useSync();

  // In cinemas is the one row every Home asks for; when it can't reach TMDB, Home says you seem to be offline.
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (!key) return;
    nowPlayingTmdb(key, region)
      .then((titles) => {
        setCinema({ region, titles });
        setOffline(false);
      })
      .catch((e: unknown) => {
        setCinema((c) => c ?? { region, titles: [] });
        setOffline(isOffline(e));
      });
  }, [key, region, round]);

  const seeds = useMemo(() => favouriteSeeds(entries), [entries]);
  const seedKey = seeds.map((s) => s.sourceId).join(',');
  useEffect(() => {
    if (!key || !seedKey) return;
    let live = true;
    // Offline, every seed's lookup comes back empty: keep the picks already showing, else the row is left out.
    const settle = (titles: Title[]) => live && setPicks((p) => (titles.length || p?.seeds !== seedKey ? { seeds: seedKey, titles } : p));
    forYou(key, seeds, entries, watchlist)
      .then(settle)
      .catch(() => settle([]));
    return () => {
      live = false;
    };
    // The picks follow your favourites; a new viewing of something else doesn't need a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, seedKey, round]);

  const pull = usePullRefresh(theme, async () => {
    refreshAnswers();
    setRound((r) => r + 1);
    await Promise.all([friends.refresh(), sync.syncNow()]);
  });

  const seen = (t: Title) => viewingsOf(t.source, t.sourceId).length > 0;
  const up = continueWatching(watchlist, today());
  const continuing = [...up.ongoing, ...up.oldFriends].slice(0, 10);
  const upNext = watchlist.filter((w) => !w.track && w.posterUrl).slice(0, 10).map(titleOf);
  const forYouTitles = !key ? [] : picks?.seeds === seedKey ? picks.titles : null;
  // Without a TMDB key nothing is asked for, so the row counts as loaded with nothing in it.
  const cinemaTitles = !key ? [] : cinema?.region === region ? cinema.titles : null;
  // The weekend and new-this-week alerts suggest the most popular film in cinemas.
  useNudges(cinemaTitles?.[0] ?? null);

  return (
    <ScrollView
      refreshControl={pull}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 32 }]}
    >
      <AppHeader theme={theme} />

      {offline && <OfflineNote theme={theme} />}

      <WeekStrip entries={entries} theme={theme} />

      <NotifyInvite />

      {nights[0] && <MovieNightCard night={nights[0]} theme={theme} showTitle />}

      {continuing.length > 0 && (
        <View style={styles.block}>
          <RowHead title="Continue watching" theme={theme} more="All" onMore={() => router.navigate({ pathname: '/watchlist', params: { view: 'watching' } })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {continuing.map((w) => {
              const next = nextUp(w.track!);
              return (
                <Tap
                  key={w.id}
                  onPress={() => router.push({ pathname: '/track', params: { id: w.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${w.title}${next ? `, next: season ${next.season} episode ${next.number}` : ''}`}
                  style={{ width: 104 }}
                >
                  {/* The badge sits on the poster's corner, clear of the name below. */}
                  <View>
                    <Poster uri={w.posterUrl} title={w.title} width={104} theme={theme} radius={6} />
                    {next && (
                      <View style={[styles.episode, { backgroundColor: theme.accent }]}>
                        <Text style={[styles.episodeText, { color: theme.accentText }]}>
                          S{next.season} E{next.number}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                    {w.title}
                  </Text>
                </Tap>
              );
            })}
          </ScrollView>
        </View>
      )}

      <FriendsRow round={round} theme={theme} />

      {upNext.length > 0 && (
        <View style={styles.block}>
          <RowHead title="Up next" theme={theme} more="All" onMore={() => router.navigate('/watchlist')} />
          <TitleRow titles={upNext} theme={theme} />
        </View>
      )}

      {seeds.length > 0 && (forYouTitles === null || forYouTitles.length > 0) && (
        <View style={styles.block}>
          <View style={styles.headGroup}>
            <RowHead title="For you" theme={theme} />
            <Text style={[styles.because, { color: theme.textMuted }]} numberOfLines={1}>
              Because you loved {seeds[0].title}
              {seeds.length > 1 ? ` and ${seeds.length - 1} more` : ''}
            </Text>
          </View>
          {forYouTitles ? <TitleRow titles={forYouTitles} theme={theme} seen={seen} /> : <Skeleton theme={theme} />}
        </View>
      )}

      {(cinemaTitles === null || cinemaTitles.length > 0) && (
        <View style={styles.block}>
          <RowHead title={`In cinemas in ${inCountry(region)}`} theme={theme} more="See all" onMore={() => browse(inCinemasQuery(region), `In cinemas in ${inCountry(region)}`)} />
          {cinemaTitles ? <TitleRow titles={cinemaTitles} theme={theme} seen={seen} /> : <Skeleton theme={theme} />}
        </View>
      )}

      <RegionalRows key={`${lang?.code ?? ''}:${round}`} region={region} mine={lang} theme={theme} seen={seen} />

      <Pressable
        onPress={() => router.navigate({ pathname: '/search', params: { mode: 'discover' } })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.discover, { backgroundColor: pressed ? theme.chip : 'transparent', borderColor: theme.border }]}
      >
        <Ionicons name="compass" size={18} color={theme.accent} />
        <Text style={[styles.discoverText, { color: theme.text }]}>Discover more</Text>
      </Pressable>
    </ScrollView>
  );
}

/** Grey poster shapes while a row loads, so the page keeps its shape. */
function Skeleton({ theme, width = 104 }: { theme: Theme; width?: number }) {
  return (
    <View style={styles.row} accessibilityLabel="Loading">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width, height: width * 1.5, borderRadius: 6, backgroundColor: theme.card }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 32 },
  block: { gap: 10 },
  row: { flexDirection: 'row', gap: 12, paddingRight: 16 },
  name: { fontSize: font.footnote, fontWeight: '600', marginTop: 8, lineHeight: 18 },
  headGroup: { gap: 4 },
  because: { fontFamily: fonts.ui, fontSize: font.caption, lineHeight: 17 },
  episode: { position: 'absolute', left: 6, bottom: 6, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  episodeText: { fontFamily: fonts.uiSemibold, fontSize: 12 },
  discover: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23, borderWidth: 1 },
  discoverText: { fontFamily: fonts.uiSemibold, fontSize: font.footnote },
});
