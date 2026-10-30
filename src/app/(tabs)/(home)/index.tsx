import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tmdbKey } from '@/api';
import { watchRegion } from '@/api/omdb';
import { discoverTmdb, nowPlayingTmdb, trendingAllTmdb } from '@/api/tmdb';
import { ScreenGlow } from '@/components/ScreenGlow';
import { AppHeader, greetingIcon, greetingLine } from '@/components/AppHeader';
import { KindBadge, Poster } from '@/components/Film';
import { FriendsRow } from '@/components/home/FriendsRow';
import { RegionalRows } from '@/components/home/RegionalRows';
import { MovieNightCard, useMovieNights } from '@/components/MovieNight';
import { RowHead, TitleRow, openTitle, warmTitle } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { today } from '@/lib/dates';
import { countryName } from '@/lib/discover';
import { useHour } from '@/lib/greeting';
import { homeLanguage, regionalFeatured } from '@/lib/regional';
import { favouriteSeeds, forYou } from '@/lib/home';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { continueWatching, nextUp } from '@/lib/tracking';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
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

  useEffect(() => {
    if (!key) return;
    trendingAllTmdb(key)
      .then(setTrending)
      .catch(() => setTrending([]));
  }, [key]);
  useEffect(() => {
    if (!key) return;
    nowPlayingTmdb(key, region)
      .then((titles) => setCinema({ region, titles }))
      .catch(() => setCinema({ region, titles: [] }));
  }, [key, region]);

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
  }, [key, regionalKey]);

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
  }, [key, seedKey]);

  const seen = (t: Title) => viewingsOf(t.source, t.sourceId).length > 0;
  const up = continueWatching(watchlist, today());
  const continuing = [...up.ongoing, ...up.oldFriends].slice(0, 10);
  // Wait for both, so the slider doesn't shift when the regional cards arrive.
  const localTitles = !regional ? [] : local?.key === regionalKey ? local.titles : null;
  const top = (trending ?? []).filter((t) => t.backdropUrl && !localTitles?.some((l) => l.sourceId === t.sourceId)).slice(0, 4);
  const featured: Slide[] =
    trending && localTitles
      ? [...localTitles.map((t) => ({ t, kicker: regional!.kicker })), ...top.map((t, i) => ({ t, kicker: `#${i + 1} THIS WEEK` }))]
      : [];
  const rest = (trending ?? []).filter((t) => !top.includes(t));
  const forYouTitles = picks?.seeds === seedKey ? picks.titles : null;
  const cinemaTitles = cinema?.region === region ? cinema.titles : null;

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 32 }]}
    >
      <ScreenGlow theme={theme} />
      <AppHeader theme={theme} line={greetingLine(hour, settings.name)} icon={greetingIcon(hour)} />

      {nights[0] && <MovieNightCard night={nights[0]} theme={theme} showTitle />}

      {featured.length ? <FeaturedCarousel slides={featured} theme={theme} /> : <View style={[styles.featuredSkeleton, { backgroundColor: theme.card }]} />}

      {continuing.length > 0 && (
        <View style={styles.block}>
          <RowHead title="Continue watching" theme={theme} more="All" onMore={() => router.navigate('/watchlist')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {continuing.map((w) => {
              const next = nextUp(w.track!);
              return (
                <Pressable
                  key={w.id}
                  onPress={() => router.push({ pathname: '/track', params: { id: w.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${w.title}${next ? `, next: season ${next.season} episode ${next.number}` : ''}`}
                  style={({ pressed }) => [{ width: 104 }, pressed && { opacity: 0.8 }]}
                >
                  <Poster uri={w.posterUrl} title={w.title} width={104} theme={theme} radius={6} />
                  {next && (
                    <View style={[styles.episode, { backgroundColor: theme.accent }]}>
                      <Text style={[styles.episodeText, { color: theme.accentText }]}>
                        S{next.season} · E{next.number}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                    {w.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {seeds.length > 0 ? (
        <View style={styles.block}>
          <View style={styles.headGroup}>
            <RowHead title="For you" theme={theme} />
            <Text style={[styles.because, { color: theme.textMuted }]} numberOfLines={1}>
              Because you loved {seeds[0].title}
              {seeds.length > 1 ? ` and ${seeds.length - 1} more` : ''}
            </Text>
          </View>
          {forYouTitles ? (
            forYouTitles.length ? (
              <TitleRow titles={forYouTitles} theme={theme} seen={seen} />
            ) : (
              <Text style={[styles.because, { color: theme.textMuted }]}>Nothing new to suggest yet. Rate a few more titles.</Text>
            )
          ) : (
            <Skeleton theme={theme} />
          )}
        </View>
      ) : (
        <Pressable
          onPress={() => router.navigate('/search')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.invite, { borderColor: theme.border, backgroundColor: pressed ? theme.chip : theme.card }]}
        >
          <MaterialCommunityIcons name="star-four-points-outline" size={24} color={theme.accent} />
          <View style={styles.inviteBody}>
            <Text style={[styles.inviteTitle, { color: theme.text }]}>Picks just for you</Text>
            <Text style={[styles.because, { color: theme.textMuted }]}>
              {entries.length
                ? 'Give a title four stars or a heart, and titles like it appear here.'
                : 'Log what you watch, and this fills with titles picked for you.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </Pressable>
      )}

      <FriendsRow theme={theme} />

      <RegionalRows key={lang?.code ?? ''} region={region} mine={lang} theme={theme} seen={seen} />

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

/** New films from where you are, then the week's top titles, as cards you swipe through, with a dot for each. */
function FeaturedCarousel({ slides, theme }: { slides: Slide[]; theme: Theme }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  return (
    <View style={styles.carousel}>
      <FlatList
        data={slides}
        keyExtractor={(s) => s.t.sourceId}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // Full width, so each card snaps to the middle; the screen's side padding is taken back for it.
        style={{ marginHorizontal: -16 }}
        onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={32}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: 16 }}>
            <Featured t={item.t} kicker={item.kicker} theme={theme} />
          </View>
        )}
      />
      {slides.length > 1 && (
        <View style={styles.dots} accessibilityLabel={`${index + 1} of ${slides.length}`}>
          {slides.map((s, i) => (
            <View key={s.t.sourceId} style={[styles.dot, { backgroundColor: i === index ? theme.accent : theme.border, width: i === index ? 18 : 6 }]} />
          ))}
        </View>
      )}
    </View>
  );
}

/** One card: its backdrop, name, and a way to log it or save it for later. */
function Featured({ t, kicker, theme }: { t: Title; kicker: string; theme: Theme }) {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { onWatchlist, addToWatchlist, removeFromWatchlist, viewingsOf } = useDiary();
  const saved = onWatchlist(t);
  const logged = viewingsOf(t.source, t.sourceId).length > 0;
  const height = Math.round((width - 32) * 0.62);
  return (
    <View style={[styles.featured, { height, backgroundColor: theme.card }]}>
      <Pressable
        onPressIn={() => warmTitle(t)}
        onPress={() => openTitle(t)}
        accessibilityRole="button"
        accessibilityLabel={`${t.title}, ${kicker.toLowerCase()}`}
        style={StyleSheet.absoluteFill}
      >
        <Image source={t.backdropUrl} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />
      </Pressable>
      <View style={styles.featuredBody} pointerEvents="box-none">
        <View style={styles.kickerRow} pointerEvents="none">
          <Text style={[styles.kicker, { color: theme.accent }]} numberOfLines={1}>
            {kicker}
          </Text>
          <KindBadge kind={t.kind} theme={theme} small />
        </View>
        <Text style={styles.featuredTitle} numberOfLines={2} pointerEvents="none">
          {t.title.toUpperCase()}
        </Text>
        <View style={styles.featuredActions}>
          <Pressable
            onPress={() => router.push({ pathname: '/log', params: { title: JSON.stringify(t) } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.logBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="add" size={18} color={theme.accentText} />
            <Text style={[styles.logText, { color: theme.accentText }]}>{logged ? 'LOG AGAIN' : 'LOG IT'}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (saved) {
                removeFromWatchlist(saved.id);
                toast('Taken off your watchlist');
              } else {
                addToWatchlist(t);
                toast('Added to your watchlist');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Take off your watchlist' : 'Add to your watchlist'}
            style={({ pressed }) => [styles.saveBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
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
  episodeText: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 0.5 },
  featured: { borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end' },
  featuredSkeleton: { height: 220, borderRadius: 16 },
  carousel: { gap: 10 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  featuredBody: { padding: 14, gap: 6 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 2 },
  featuredTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: '#FFFFFF', letterSpacing: 1 },
  featuredActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  logBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 18, borderRadius: 20 },
  logText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.5 },
  saveBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  inviteBody: { flex: 1, gap: 4 },
  inviteTitle: { fontSize: font.body, fontWeight: '700' },
  discover: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23, borderWidth: 1 },
  discoverText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.5 },
});
