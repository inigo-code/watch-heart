import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { search, sourceFor, tmdbKey, trending } from '@/api';
import { watchRegion } from '@/api/omdb';
import { ScreenGlow } from '@/components/ScreenGlow';
import { DiscoverHome } from '@/components/discover/DiscoverHome';
import { Poster } from '@/components/Film';
import { openTitle, warmTitle } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { DATA_SOURCES } from '@/lib/app';
import { KIND_COLORS, font, fonts, useTheme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { MediaKind, Title } from '@/store/types';

const KINDS: { kind: MediaKind; label: string }[] = [
  { kind: 'movie', label: 'FILMS' },
  { kind: 'tv', label: 'SERIES' },
  { kind: 'anime', label: 'ANIME' },
];

const PLACEHOLDER: Record<MediaKind, string> = {
  movie: 'Try “Past Lives” or “Dune”',
  tv: 'Try “Severance” or “The Bear”',
  anime: 'Try “Frieren” or “Cowboy Bebop”',
};

export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const { viewingsOf, onWatchlist, addToWatchlist, removeFromWatchlist } = useDiary();
  const toast = useToast();
  const kind = settings.searchKind;
  const key = tmdbKey(settings.tmdbKey);
  const source = sourceFor(kind, key);
  const params = useLocalSearchParams<{ q?: string; kind?: MediaKind; mode?: 'discover' | 'trending' }>();
  const [query, setQuery] = useState(params.q ?? '');
  // Arriving from a share (or anywhere with ?q=) fills in the search and picks the kind.
  const [lastQ, setLastQ] = useState(params.q);
  if (params.q !== lastQ) {
    setLastQ(params.q);
    if (params.q) setQuery(params.q);
  }
  useEffect(() => {
    if (params.kind) update({ searchKind: params.kind });
  }, [params.kind, params.q, update]);
  const [results, setResults] = useState<Title[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = query.trim();
  // Before you type: this week's trending titles, or ways to browse (Discover).
  const [mode, setMode] = useState<'trending' | 'discover'>(params.mode === 'discover' ? 'discover' : 'trending');
  const [lastMode, setLastMode] = useState(params.mode);
  if (params.mode !== lastMode) {
    setLastMode(params.mode);
    if (params.mode) setMode(params.mode);
  }
  const discovering = !q && mode === 'discover' && source === 'tmdb';

  // Search as you type, after a short pause; with no query, show what's trending.
  useEffect(() => {
    if (!source || discovering) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(null);
        (q ? search(kind, q, key, controller.signal) : trending(kind, key, controller.signal))
          .then((r) => setResults(r))
          .catch((e) => {
            if (controller.signal.aborted) return;
            setResults([]);
            setError(e instanceof Error && e.message !== 'Network request failed' ? e.message : 'No connection. Check your internet and try again.');
          })
          .finally(() => !controller.signal.aborted && setLoading(false));
      },
      q ? 400 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, q, key, source, discovering]);

  const open = (t: Title) => {
    Keyboard.dismiss();
    router.push({ pathname: '/log', params: { title: JSON.stringify(t) } });
  };
  const about = (t: Title) => {
    Keyboard.dismiss();
    openTitle(t);
  };

  const credit = useMemo(
    () => (source ? (source === 'tmdb' ? DATA_SOURCES.tmdb.label : source === 'anilist' ? DATA_SOURCES.anilist.label : DATA_SOURCES.tvmaze.label) : null),
    [source],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top + 10 }]}>
      <ScreenGlow theme={theme} />
      <View style={styles.top}>
        <Text style={[styles.heading, { color: theme.text }]}>
          WHAT DID YOU <Text style={{ color: theme.accent }}>WATCH?</Text>
        </Text>
        <View style={[styles.search, { backgroundColor: theme.chip }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={PLACEHOLDER[kind]}
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {loading && source ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            !!query && (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </Pressable>
            )
          )}
        </View>
        {!q && source === 'tmdb' && (
          <View style={[styles.modes, { backgroundColor: theme.chip }]} accessibilityRole="tablist">
            {(['trending', 'discover'] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[styles.mode, on && { backgroundColor: theme.accent }]}
                >
                  <Ionicons name={m === 'discover' ? 'compass' : 'flame'} size={16} color={on ? theme.accentText : theme.textMuted} />
                  <Text style={[styles.modeText, { color: on ? theme.accentText : theme.textMuted }]}>{m === 'discover' ? 'DISCOVER' : 'TRENDING'}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {/* Discover covers films, series and anime alike; the kind is for trending and search. */}
        {!discovering && (
          <View style={[styles.kinds, { borderColor: theme.border }]}>
            {KINDS.map((k) => {
              const active = k.kind === kind;
              return (
                <Pressable
                  key={k.kind}
                  onPress={() => update({ searchKind: k.kind })}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.kind, active && { backgroundColor: KIND_COLORS[k.kind] }]}
                >
                  <Text style={[styles.kindText, { color: active ? '#0B0A0D' : theme.textMuted }]}>{k.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <FlatList
        data={source && !discovering ? results : []}
        keyExtractor={(t) => `${t.source}:${t.sourceId}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          <>
            {discovering ? (
              <DiscoverHome theme={theme} tmdb={key} region={watchRegion(settings.watchRegion)} />
            ) : !source ? (
              <NeedsKey theme={theme} kind={kind} onManual={() => router.push({ pathname: '/log', params: { manual: kind } })} />
            ) : error ? (
              <Text style={[styles.note, { color: theme.danger }]}>{error}</Text>
            ) : results.length > 0 ? (
              <Text style={[styles.section, { color: theme.textMuted }]}>
                {q ? 'RESULTS' : source === 'tvmaze' ? 'POPULAR ON TV TODAY' : 'TRENDING THIS WEEK'}
              </Text>
            ) : !loading && q ? (
              <Text style={[styles.note, { color: theme.textMuted }]}>Nothing found for “{q}”.</Text>
            ) : !loading && kind === 'tv' && source === 'tvmaze' ? (
              <Text style={[styles.note, { color: theme.textMuted }]}>Type a series name to search TVmaze.</Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => {
          const seen = viewingsOf(item.source, item.sourceId).length;
          const saved = onWatchlist(item);
          // Two buttons side by side (log it, bookmark it), not one inside the other.
          return (
            <View style={[styles.row, { borderBottomColor: theme.border }]}>
              <Pressable
                onPressIn={() => warmTitle(item)}
                onPress={() => about(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}${item.year ? `, ${item.year}` : ''}`}
                style={({ pressed }) => [styles.rowMain, { backgroundColor: pressed ? theme.chip : 'transparent' }]}
              >
                <Poster uri={item.posterUrl} title={item.title} width={58} theme={theme} radius={4} />
                <View style={styles.rowBody}>
                  <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                    {item.title}
                    {item.year ? <Text style={[styles.year, { color: theme.textMuted }]}>{`  ${item.year}`}</Text> : null}
                  </Text>
                  {!!item.originalTitle && (
                    <Text style={[styles.original, { color: theme.textMuted }]} numberOfLines={1}>
                      {item.originalTitle}
                    </Text>
                  )}
                  {!!item.overview && (
                    <Text style={[styles.overview, { color: theme.textMuted }]} numberOfLines={2}>
                      {item.overview}
                    </Text>
                  )}
                  {seen > 0 && (
                    <View style={[styles.seen, { borderColor: theme.accent }]}>
                      <MaterialCommunityIcons name="ticket-confirmation" size={12} color={theme.accent} />
                      <Text style={[styles.seenText, { color: theme.accent }]}>{seen === 1 ? 'IN YOUR DIARY' : `SEEN ${seen}×`}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
              <Pressable onPress={() => open(item)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Log ${item.title}`} style={styles.rowBtn}>
                <Ionicons name="add-circle-outline" size={27} color={theme.accent} />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (saved) {
                    removeFromWatchlist(saved.id);
                    toast('Taken off your watchlist');
                  } else {
                    addToWatchlist(item);
                    toast('Added to your watchlist');
                  }
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={saved ? `Take ${item.title} off your watchlist` : `Add ${item.title} to your watchlist`}
                style={styles.rowBtn}
              >
                <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={23} color={saved ? theme.accent : theme.textMuted} />
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={
          source && !discovering ? (
            <View style={styles.footer}>
              <Pressable
                onPress={() => router.push({ pathname: '/log', params: { manual: kind } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.manual, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="create-outline" size={16} color={theme.text} />
                <Text style={[styles.manualText, { color: theme.text }]}>CAN’T FIND IT? ADD BY HAND</Text>
              </Pressable>
              {credit && <Text style={[styles.credit, { color: theme.textMuted }]}>Search by {credit}</Text>}
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

/** Film (and anime) search needs a free TMDB key; explain how to get one, without blocking anything else. */
function NeedsKey({ theme, kind, onManual }: { theme: ReturnType<typeof useTheme>; kind: MediaKind; onManual: () => void }) {
  return (
    <View style={[styles.keyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <MaterialCommunityIcons name="key-chain-variant" size={28} color={theme.accent} />
      <Text style={[styles.keyTitle, { color: theme.text }]}>{kind === 'anime' ? 'ANIME' : 'FILM'} SEARCH NEEDS A FREE TMDB KEY</Text>
      <Text style={[styles.keyText, { color: theme.textMuted }]}>
        TMDB is the free film and TV database most apps use. Make an account at themoviedb.org, open Settings → API, copy your key, then paste it into Watch
        Heart’s settings. Series search already works without one.
      </Text>
      <View style={styles.keyButtons}>
        <Pressable onPress={() => router.push('/settings')} style={[styles.keyBtn, { backgroundColor: theme.accent }]} accessibilityRole="button">
          <Text style={[styles.keyBtnText, { color: theme.accentText }]}>ADD KEY</Text>
        </Pressable>
        <Pressable onPress={onManual} style={[styles.keyBtn, { borderColor: theme.border, borderWidth: 1 }]} accessibilityRole="button">
          <Text style={[styles.keyBtnText, { color: theme.text }]}>ADD BY HAND</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  heading: { fontFamily: fonts.display, fontSize: font.marquee, lineHeight: 46, letterSpacing: 1, includeFontPadding: false },
  kinds: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 3, gap: 3 },
  kind: { flex: 1, height: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  kindText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.5 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 46, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: font.body, height: '100%' },
  list: { paddingHorizontal: 16 },
  section: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1.5, paddingVertical: 8 },
  note: { fontFamily: fonts.mono, fontSize: font.footnote, paddingVertical: 12, lineHeight: 19 },
  rowBtn: { padding: 8 },
  modes: { flexDirection: 'row', borderRadius: 22, padding: 4, gap: 4 },
  mode: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 18 },
  modeText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.5 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  rowBody: { flex: 1, gap: 3 },
  title: { fontSize: font.headline, fontWeight: '700' },
  year: { fontFamily: fonts.mono, fontSize: font.footnote, fontWeight: '400' },
  original: { fontFamily: fonts.mono, fontSize: font.caption },
  overview: { fontSize: font.footnote, lineHeight: 18 },
  seen: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, marginTop: 2 },
  seenText: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1 },
  footer: { alignItems: 'center', gap: 12, paddingTop: 20 },
  manual: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 22, height: 44, paddingHorizontal: 18 },
  manualText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
  credit: { fontFamily: fonts.mono, fontSize: font.caption },
  keyCard: { borderWidth: 1, borderRadius: 14, padding: 18, gap: 10, marginTop: 8 },
  keyTitle: { fontFamily: fonts.display, fontSize: 24, letterSpacing: 1 },
  keyText: { fontFamily: fonts.mono, fontSize: font.footnote, lineHeight: 19 },
  keyButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  keyBtn: { height: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  keyBtnText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
});
