import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { CineIcon } from '@/components/CineIcon';
import { ConfirmTrash } from '@/components/ConfirmTrash';
import { useDaySheet } from '@/components/DaySheet';
import { EASE, Tap, useReducedMotion } from '@/components/Motion';
import { trackable } from '@/api/episodes';
import { browseGenre } from '@/api/tmdb';
import { Stars } from '@/components/Film';
import { Hero } from '@/components/Hero';
import { AddToList } from '@/components/lists/AddToList';
import { MovieNightCard, MovieNightSheet, useMovieNights } from '@/components/MovieNight';
import { SectionLabel } from '@/components/SectionLabel';
import { TitleExtras } from '@/components/TitleExtras';
import { Synopsis, TitleMore, useAbout } from '@/components/title/AboutTitle';
import { FriendsOnTitle } from '@/components/title/FriendsOnTitle';
import { useConfirm, watchlistAsk } from '@/components/Confirm';
import { useToast } from '@/components/Toast';
import { TopScrim } from '@/components/TopScrim';
import { friendlyDate } from '@/lib/dates';
import { useQuickLog } from '@/lib/useQuickLog';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useLists } from '@/lists/ListsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Entry, Title } from '@/store/types';

/**
 * A film or series before (or after) you log it: what it is, who made it, where to watch it, and what
 * to watch next. Opened from search, Discover, recommendations and people's pages.
 */
export default function TitleScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [scrollY] = useState(() => new Animated.Value(0));
  const { width } = useWindowDimensions();
  const toast = useToast();
  const confirm = useConfirm();
  const params = useLocalSearchParams<{ id: string; t?: string }>();
  const id = params.id;
  const { viewingsOf, queued, addToWatchlist, removeFromWatchlist, deleteEntry, restoreEntry } = useDiary();
  const [trashing, setTrashing] = useState<Entry | null>(null);
  const { listsWith } = useLists();
  const seed = useMemo(() => (params.t ? (JSON.parse(params.t) as Title) : null), [params.t]);
  const { about: a, error, loading } = useAbout(id);
  const [listing, setListing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const { forTitle } = useMovieNights();
  // Hold Log it to log on a day straight away, without the form.
  const days = useDaySheet();
  const quickLog = useQuickLog();
  // Opened before its details arrived: placeholders hold the page's shape, then the page fades in once,
  // instead of lines and buttons popping in one by one. Details already here show at once.
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(loading ? 0 : 1));
  useEffect(() => {
    if (loading) return;
    if (reduced) shown.setValue(1);
    else Animated.timing(shown, { toValue: 1, duration: 220, easing: EASE, useNativeDriver: true }).start();
  }, [loading, reduced, shown]);

  // Search in the Anime tab knows it's anime; TMDB's own details can't always tell (an anime film, say).
  const t: Title | null = a ? { ...a.title, kind: seed?.kind === 'anime' ? 'anime' : a.title.kind, overview: a.overview } : seed;

  if (!t) {
    return (
      <View style={styles.center}>
        {error ? <Text style={[styles.muted, { color: theme.textMuted }]}>{error}</Text> : <ActivityIndicator color={theme.accent} />}
      </View>
    );
  }

  const viewings = viewingsOf(t.source, t.sourceId);
  const saved = queued(t);
  const onLists = listsWith(t);

  const log = () => router.push({ pathname: '/log', params: { title: JSON.stringify(t) } });
  const toggleWatchlist = () => {
    if (saved) {
      confirm(
        watchlistAsk(saved.title, !!saved.track, () => {
          removeFromWatchlist(saved.id);
          toast('Taken off your watchlist');
        }),
      );
    } else {
      addToWatchlist(t);
      toast('Added to your watchlist');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <Hero t={{ ...t, genres: [] }} theme={theme} topInset={insets.top} scrollY={scrollY} pending={loading} />

        {loading ? (
          <BodyPlaceholder theme={theme} />
        ) : (
        <Animated.View style={[styles.body, { opacity: shown }]}>
          {t.genres.length > 0 && (
            <View style={styles.genres}>
              {t.genres.map((g) => {
                const genre = browseGenre(g);
                return (
                  <Pressable
                    key={g}
                    disabled={!genre}
                    onPress={() =>
                      genre && router.push({ pathname: '/browse', params: { q: JSON.stringify({ kind: t.kind, genres: [genre.name] }), name: genre.name } })
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
              onLongPress={() => days.ask({ title: t.title }, (d) => quickLog(t, d))}
              accessibilityRole="button"
              accessibilityHint="Long press to log it on a day without the form"
              style={({ pressed }) => [styles.logBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <CineIcon name="log" size={22} color={theme.accentText} />
              <Text style={[styles.logText, { color: theme.accentText }]}>{viewings.length ? 'Log again' : 'Log it'}</Text>
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
            {a?.trailer && (
              <Tool theme={theme} icon="play-circle-outline" label="Trailer" onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${a.trailer}`)} />
            )}
            <Tool theme={theme} icon="calendar-outline" label={forTitle(t.sourceId) ? 'Change the plan' : 'Plan a watch'} onPress={() => setPlanning(true)} />
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

          {(() => {
            const night = forTitle(t.sourceId);
            return night ? <MovieNightCard night={night} theme={theme} /> : null;
          })()}

          {viewings.length > 0 && (
            <View style={styles.block}>
              <SectionLabel theme={theme}>In your diary, {viewings.length === 1 ? 'seen once' : viewings.length === 2 ? 'seen twice' : `seen ${viewings.length} times`}</SectionLabel>
              {viewings.map((v) => (
                <View key={v.id} style={[styles.viewing, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/entry/[id]', params: { id: v.id } })}
                    accessibilityRole="button"
                    style={styles.viewingOpen}
                  >
                  <Ionicons name="ticket-outline" size={16} color={theme.accent} />
                  <Text style={[styles.viewingDate, { color: theme.text }]}>{v.season ? `Season ${v.season}, ` : ''}
                    {v.undated ? 'Date unknown' : friendlyDate(v.watchedOn)}
                  </Text>
                  {v.rating ? <Stars rating={v.rating} size={13} color={theme.star} /> : null}
                  {v.liked && <Ionicons name="heart" size={14} color={theme.like} />}
                  </Pressable>
                  <Pressable onPress={() => setTrashing(v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete the viewing from ${v.undated ? 'an unknown date' : friendlyDate(v.watchedOn)}`} style={styles.viewingDelete}>
                    <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Synopsis about={a} overview={t.overview ?? ''} theme={theme} />

          <TitleExtras source={t.source} sourceId={t.sourceId} title={t.title} year={t.year} series={t.kind !== 'movie'} theme={theme} />

          <FriendsOnTitle source={t.source} sourceId={t.sourceId} theme={theme} />

          {a && <TitleMore id={id} t={t} about={a} theme={theme} />}
        </Animated.View>
        )}
      </Animated.ScrollView>
      {/* The backdrop is the width × 0.56; the bar fills in as its bottom passes under it. */}
      <TopScrim scrollY={scrollY} theme={theme} topInset={insets.top} from={Math.round(width * 0.56) - 56} />
      <AddToList item={listing ? t : null} theme={theme} onClose={() => setListing(false)} />
      {days.sheet}
      <MovieNightSheet t={t} visible={planning} theme={theme} onClose={() => setPlanning(false)} />
      <ConfirmTrash
        title={trashing?.title ?? null}
        onConfirm={() => {
          if (!trashing) return;
          const gone = trashing;
          deleteEntry(gone.id);
          toast('Viewing moved to Trash', { label: 'Undo', onPress: () => restoreEntry(gone.id) });
        }}
        onClose={() => setTrashing(null)}
      />
    </View>
  );
}

/** The page's shape while its details load: genres, the log button, the tools, a few lines of synopsis. */
function BodyPlaceholder({ theme }: { theme: Theme }) {
  const bar = { backgroundColor: theme.chip };
  return (
    <View style={styles.body} accessibilityLabel="Loading" accessible>
      <View style={styles.genres}>
        <View style={[styles.ghostPill, bar, { width: 92 }]} />
        <View style={[styles.ghostPill, bar, { width: 76 }]} />
      </View>
      <View style={[styles.ghostLog, bar]} />
      <View style={styles.tools}>
        <View style={[styles.ghostTool, bar]} />
        <View style={[styles.ghostTool, bar]} />
        <View style={[styles.ghostTool, bar]} />
      </View>
      <View style={styles.ghostLines}>
        {(['100%', '96%', '88%', '60%'] as const).map((w) => (
          <View key={w} style={[styles.ghostLine, bar, { width: w }]} />
        ))}
      </View>
    </View>
  );
}

function Tool({ theme, icon, label, onPress }: { theme: Theme; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} accessibilityRole="button" style={[styles.tool, { borderColor: theme.border }]}>
      <Ionicons name={icon} size={17} color={theme.text} />
      <Text style={[styles.toolText, { color: theme.text }]}>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontFamily: fonts.ui, fontSize: font.body, textAlign: 'center' },
  body: { padding: 16, gap: 22 },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6 },
  genre: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  genreText: { fontSize: font.footnote, fontWeight: '600' },
  mainActions: { flexDirection: 'row', gap: 10 },
  logBtn: { flex: 1, minHeight: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logText: { fontFamily: fonts.uiSemibold, fontSize: font.body },
  square: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -10 },
  ghostPill: { height: 32, borderRadius: 16 },
  ghostLog: { height: 50, borderRadius: 25 },
  ghostTool: { width: 112, height: 42, borderRadius: 21 },
  ghostLines: { gap: 10 },
  ghostLine: { height: 12, borderRadius: 6 },
  tool: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  toolText: { fontFamily: fonts.uiSemibold, fontSize: font.caption },
  block: { gap: 10 },
  viewing: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingLeft: 12 },
  viewingOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 46 },
  viewingDelete: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  viewingDate: { flex: 1, fontFamily: fonts.ui, fontSize: font.body },
});
