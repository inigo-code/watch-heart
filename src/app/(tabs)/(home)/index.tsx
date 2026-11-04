import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
import { discoverTmdb, nowPlayingTmdb, trendingAllTmdb } from '@/api/tmdb';
import { AppHeader, greetingIcon, greetingLine } from '@/components/AppHeader';
import { Poster } from '@/components/Film';
import { FriendsRow } from '@/components/home/FriendsRow';
import { MonthTicket } from '@/components/home/MonthTicket';
import { RegionalRows } from '@/components/home/RegionalRows';
import { MovieNightCard, useMovieNights } from '@/components/MovieNight';
import { RowHead, TitleRow, openTitle, warmTitle } from '@/components/title/Rows';
import { today } from '@/lib/dates';
import { countryName } from '@/lib/discover';
import { useHour } from '@/lib/greeting';
import { homeLanguage, regionalFeatured } from '@/lib/regional';
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
 * Home: something to watch tonight, the moment the app opens. The week's top title, then a few rows: the
 * series you're in the middle of, picks from what you loved, what's trending, and what's in cinemas.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const hour = useHour();
  const { settings } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const region = watchRegion(settings.watchRegion);
  const { entries, watchlist, viewingsOf } = useDiary();
  const { nights } = useMovieNights();
  const [trending, setTrending] = useState<Title[] | null>(null);
  const [cinema, setCinema] = useState<{ region: string; titles: Title[] } | null>(null);
  const [picks, setPicks] = useState<{ seeds: string; titles: Title[] } | null>(null);
  const lang = homeLanguage(region, settings.homeLanguage);
  const regional = regionalFeatured(region, lang);
  const regionalKey = regional ? JSON.stringify(regional.q) : '';
  const [local, setLocal] = useState<{ key: string; titles: Title[] } | null>(null);
  // Each pull to refresh asks everything again.
  const [round, setRound] = useState(0);
  const friends = useFriends();
  const sync = useSync();

  useEffect(() => {
    if (!key) return;
    trendingAllTmdb(key)
      .then(setTrending)
      .catch(() => setTrending((t) => t ?? []));
  }, [key, round]);
  useEffect(() => {
    if (!key) return;
    nowPlayingTmdb(key, region)
      .then((titles) => setCinema({ region, titles }))
      .catch(() => setCinema((c) => c ?? { region, titles: [] }));
  }, [key, region, round]);

  // The slider's first cards: new films in your language, or from your country.
  useEffect(() => {
    if (!key || !regional) return;
    let live = true;
    // Only titles people know lead the slider: new releases with some votes already (Jailer 2, not a film
    // three people have heard of); in a quiet week, the most popular new release.
    // Two slides: the best known first, then the best rated new release with a few votes, then the most
    // popular, so a quiet week still fills both.
    const usable = (r: { results: Title[] }) => r.results.filter((t) => t.backdropUrl && t.posterUrl);
    Promise.all([
      discoverTmdb(key, { ...regional.q, minVotes: 10 }, 1).catch(() => ({ results: [] as Title[] })),
      discoverTmdb(key, { ...regional.q, sort: 'rating', minVotes: 3 }, 1).catch(() => ({ results: [] as Title[] })),
      discoverTmdb(key, regional.q, 1).catch(() => ({ results: [] as Title[] })),
    ])
      .then((answers) => {
        const picked: Title[] = [];
        for (const t of answers.flatMap(usable)) if (picked.length < 2 && !picked.some((p) => p.sourceId === t.sourceId)) picked.push(t);
        if (live) setLocal({ key: regionalKey, titles: picked });
      })
      .catch(() => live && setLocal({ key: regionalKey, titles: [] }));
    return () => {
      live = false;
    };
    // The query is compared by its JSON (`regionalKey`), not by identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, regionalKey, round]);

  // On a slow connection the regional cards shouldn't hold back a slider that's ready: after a moment it
  // shows what it has, and they join it when they come.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const seeds = useMemo(() => favouriteSeeds(entries), [entries]);
  const seedKey = seeds.map((s) => s.sourceId).join(',');
  useEffect(() => {
    if (!key || !seedKey) return;
    let live = true;
    forYou(key, seeds, entries, watchlist).then((titles) => live && setPicks({ seeds: seedKey, titles }));
    return () => {
      live = false;
    };
    // The picks follow your favourites; a new viewing of something else doesn't need a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, seedKey, round]);

  const pull = usePullRefresh(theme, async () => {
    refreshAnswers();
    setRound((r) => r + 1);
    await Promise.all([key ? trendingAllTmdb(key).then(setTrending) : null, friends.refresh(), sync.syncNow()]);
  });

  const seen = (t: Title) => viewingsOf(t.source, t.sourceId).length > 0;
  const up = continueWatching(watchlist, today());
  const continuing = [...up.ongoing, ...up.oldFriends].slice(0, 10);
  // Wait for both for a moment, so the slider doesn't shift when the regional cards arrive.
  const localTitles = !regional ? [] : local?.key === regionalKey ? local.titles : waited ? [] : null;
  const top = (trending ?? []).filter((t) => t.backdropUrl && !localTitles?.some((l) => l.sourceId === t.sourceId)).slice(0, 4);
  const featured: Slide[] =
    trending && localTitles
      ? [...localTitles.map((t) => ({ t, kicker: regional!.kicker })), ...top.map((t, i) => ({ t, kicker: `#${i + 1} THIS WEEK` }))]
      : [];
  const rest = (trending ?? []).filter((t) => !top.includes(t));
  const upNext = watchlist.filter((w) => !w.track && w.posterUrl).slice(0, 10).map(titleOf);
  const forYouTitles = picks?.seeds === seedKey ? picks.titles : null;
  const cinemaTitles = cinema?.region === region ? cinema.titles : null;

  return (
    <ScrollView
      refreshControl={pull}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 32 }]}
    >
      <AppHeader theme={theme} line={greetingLine(hour, settings.name)} icon={greetingIcon(hour)} />

      <MonthTicket entries={entries} theme={theme} />

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
                          S{next.season} · E{next.number}
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

      <FriendsRow key={round} theme={theme} />

      {upNext.length > 0 && (
        <View style={styles.block}>
          <RowHead title="Up next" theme={theme} more="All" onMore={() => router.navigate('/watchlist')} />
          <TitleRow titles={upNext} theme={theme} width={92} />
        </View>
      )}

      {seeds.length > 0 && (
        <View style={styles.block}>
          <View style={styles.headGroup}>
            <RowHead title="For you" theme={theme} />
            <Text style={[styles.because, { color: theme.textMuted }]} numberOfLines={1}>
              Because you loved {seeds[0].title}
              {seeds.length > 1 ? ` and ${seeds.length - 1} more` : ''}
            </Text>
          </View>
          {forYouTitles ? forYouTitles.length > 0 && <TitleRow titles={forYouTitles} theme={theme} seen={seen} /> : <Skeleton theme={theme} />}
        </View>
      )}

      <View style={styles.block}>
        <RowHead title="New this week" theme={theme} more="Find" onMore={() => router.navigate('/search')} />
        {featured.length ? <NewRow slides={featured} theme={theme} /> : <View style={[styles.newSkeleton, { backgroundColor: theme.card }]} />}
      </View>

      <RegionalRows key={`${lang?.code ?? ''}:${round}`} region={region} mine={lang} theme={theme} seen={seen} />

      <View style={styles.block}>
        <RowHead title="Trending this week" theme={theme} more="More" onMore={() => router.navigate('/search')} />
        {trending ? <TitleRow titles={rest} theme={theme} seen={seen} width={112} /> : <Skeleton theme={theme} width={112} />}
      </View>

      {(cinemaTitles === null || cinemaTitles.length > 0) && (
        <View style={styles.block}>
          <RowHead title={`In cinemas · ${countryName(region)}`} theme={theme} />
          {cinemaTitles ? <TitleRow titles={cinemaTitles} theme={theme} seen={seen} /> : <Skeleton theme={theme} />}
        </View>
      )}

      <Pressable
        onPress={() => router.navigate({ pathname: '/search', params: { mode: 'discover' } })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.discover, { backgroundColor: pressed ? theme.chip : 'transparent', borderColor: theme.border }]}
      >
        <Ionicons name="compass" size={18} color={theme.accent} />
        <Text style={[styles.discoverText, { color: theme.text }]}>DISCOVER MORE</Text>
      </Pressable>
    </ScrollView>
  );
}

type Slide = { t: Title; kicker: string };

/** New films from where you are, then the week's top titles, as small wide cards that open the title. */
function NewRow({ slides, theme }: { slides: Slide[]; theme: Theme }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {slides.map(({ t, kicker }) => (
        <Tap
          key={t.sourceId}
          onPressIn={() => warmTitle(t)}
          onPress={() => openTitle(t)}
          accessibilityRole="button"
          accessibilityLabel={`${t.title}, ${kicker.toLowerCase()}`}
          style={[styles.newCard, { backgroundColor: theme.card }]}
        >
          {/* The poster, already fetched for the rows below, holds the place while the wider picture comes. */}
          <Image
            source={t.backdropUrl}
            placeholder={t.posterUrl ? { uri: t.posterUrl } : undefined}
            placeholderContentFit="cover"
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />
          <View style={styles.newBody}>
            <Text style={[styles.kicker, { color: theme.accentOnDark }]} numberOfLines={1}>
              {kicker}
            </Text>
            <Text style={styles.newTitle} numberOfLines={1}>
              {t.title.toUpperCase()}
            </Text>
          </View>
        </Tap>
      ))}
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
  content: { paddingHorizontal: 16, gap: 24 },
  block: { gap: 10 },
  row: { flexDirection: 'row', gap: 12, paddingRight: 16 },
  name: { fontSize: font.footnote, fontWeight: '700', marginTop: 6 },
  headGroup: { gap: 4 },
  because: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17 },
  episode: { position: 'absolute', left: 6, bottom: 6, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  episodeText: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 0.5 },
  newCard: { width: 248, height: 140, borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end' },
  newSkeleton: { height: 140, borderRadius: 12 },
  newBody: { padding: 12, gap: 2 },
  kicker: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 1 },
  newTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: '#FFFFFF', letterSpacing: 1 },
  discover: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23, borderWidth: 1 },
  discoverText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.5 },
});
