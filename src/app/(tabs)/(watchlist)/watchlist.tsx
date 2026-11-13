import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { trackable } from '@/api/episodes';
import { ActionSheet } from '@/components/ActionSheet';
import { ContinueWatching } from '@/components/ContinueWatching';
import { AddToList } from '@/components/lists/AddToList';
import { MovieNightSheet, nightLabel, useMovieNights } from '@/components/MovieNight';
import { openTitle } from '@/components/title/Rows';
import { Chip, KindBadge, Poster } from '@/components/Film';
import { Pop, Rise, Tap, useReducedMotion } from '@/components/Motion';
import { usePullRefresh } from '@/components/PullRefresh';
import { Segments } from '@/components/Segments';
import { useToast } from '@/components/Toast';
import { formatRuntime } from '@/lib/dates';
import { KIND_COLORS, font, fonts, shadow, useTheme } from '@/lib/theme';
import { useLists } from '@/lists/ListsProvider';
import { useSettings } from '@/settings/SettingsProvider';
import type { Theme } from '@/lib/theme';
import { titleOf, useDiary } from '@/store/DiaryStore';
import { useSync } from '@/sync/SyncProvider';
import type { MediaKind, WatchItem } from '@/store/types';

type Filter = 'all' | MediaKind;
type Sort = 'added' | 'title' | 'year' | 'runtime';
type Side = 'next' | 'watching';

const SORTS: Record<Sort, { label: string; next: Sort }> = {
  added: { label: 'Recently added', next: 'title' },
  title: { label: 'A–Z', next: 'year' },
  year: { label: 'Newest release', next: 'runtime' },
  runtime: { label: 'Shortest first', next: 'added' },
};

/** A film's running time, or a series' or anime's per episode (that's what TMDB, TVmaze and AniList give). */
const runtimeLabel = (w: WatchItem) => (w.runtime ? `${formatRuntime(w.runtime)}${w.kind === 'movie' ? '' : ' per ep'}` : null);

const COLS = 3;
const GAP = 12;
// The roulette: this many posters flicker past, each a little slower than the last.
const ROLLS = 9;

export default function WatchlistScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { watchlist, removeFromWatchlist, importWatchlist } = useDiary();
  const { forTitle } = useMovieNights();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('added');
  const [menu, setMenu] = useState<WatchItem | null>(null);
  const [pick, setPick] = useState<WatchItem | null>(null);
  const [listing, setListing] = useState<WatchItem | null>(null);
  const [planning, setPlanning] = useState<WatchItem | null>(null);
  const { lists } = useLists();
  const sync = useSync();
  const pull = usePullRefresh(theme, () => sync.syncNow());
  const { settings } = useSettings();
  const reduced = useReducedMotion();
  const params = useLocalSearchParams<{ view?: string }>();
  const [rolling, setRolling] = useState(false);
  const roll = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (roll.current && clearTimeout(roll.current)), []);
  // Which side of the switch: what you last tapped, unless a link (Home's "All") has asked for one since.
  const [chosen, setChosen] = useState<{ from: string | undefined; view: Side } | null>(null);
  const tile = (width - 32 - GAP * (COLS - 1)) / COLS;

  const queue = useMemo(() => watchlist.filter((w) => !w.track), [watchlist]);
  const tracked = useMemo(() => watchlist.filter((w) => w.track), [watchlist]);
  const view: Side = !tracked.length
    ? 'next'
    : chosen && chosen.from === params.view
      ? chosen.view
      : params.view === 'watching' || !queue.length
        ? 'watching'
        : 'next';
  const shown = useMemo(() => {
    const list = queue.filter((w) => filter === 'all' || w.kind === filter);
    if (sort === 'title') return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'year') return [...list].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    // For something that fits the evening; titles without a running time go last.
    if (sort === 'runtime') return [...list].sort((a, b) => (a.runtime || Number.MAX_SAFE_INTEGER) - (b.runtime || Number.MAX_SAFE_INTEGER));
    return list;
  }, [queue, filter, sort]);

  const log = (w: WatchItem) => router.push({ pathname: '/log', params: { title: JSON.stringify(titleOf(w)) } });
  const remove = (w: WatchItem) => {
    removeFromWatchlist(w.id);
    toast(`Took “${w.title}” off your watchlist`, { label: 'Undo', onPress: () => importWatchlist([w]) });
  };
  // Never the same title twice in a row, when there's a choice. A few posters flicker past first, like a
  // reel running down, and it lands with a tap you can feel.
  const spin = () => {
    const pool = shown.length > 1 && pick ? shown.filter((w) => w.id !== pick.id) : shown;
    const final = pool[Math.floor(Math.random() * pool.length)] ?? null;
    if (reduced || shown.length < 2 || !final) {
      setPick(final);
      return;
    }
    setRolling(true);
    let step = 0;
    const next = () => {
      step += 1;
      if (step >= ROLLS) {
        setPick(final);
        setRolling(false);
        if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        return;
      }
      setPick(shown[step % shown.length]);
      roll.current = setTimeout(next, 60 + step * step * 3);
    };
    next();
  };

  const header = (
    <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headRow}>
        <View style={styles.titleBlock}>
          <Text maxFontSizeMultiplier={1.15} accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
            WATCH<Text style={{ color: theme.accent }}>LIST</Text>
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={1}>
            {queue.length ? `${queue.length} saved` : 'For later'}
          </Text>
        </View>
        <Tap onPress={() => router.push('/lists')} accessibilityRole="button" accessibilityLabel="Your lists" style={[styles.listsBtn, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
          <Ionicons name="albums" size={20} color={theme.accent} />
          <Text style={[styles.listsText, { color: theme.text }]} numberOfLines={1}>
            MY LISTS{lists.length ? ` · ${lists.length}` : ''}
          </Text>
        </Tap>
      </View>
      {tracked.length > 0 && (
        <Segments
          theme={theme}
          value={view}
          onChange={(v) => setChosen({ from: params.view, view: v })}
          options={[
            { key: 'next', label: `UP NEXT · ${queue.length}` },
            { key: 'watching', label: `WATCHING · ${tracked.length}` },
          ]}
        />
      )}
      <ContinueWatching items={watchlist} theme={theme} hidden={view !== 'watching'} />
      {view === 'next' && queue.length > 0 && (
        <>
          <Tap
            onPress={spin}
            disabled={!shown.length}
            accessibilityRole="button"
            style={[styles.pickBtn, { backgroundColor: theme.accent, boxShadow: shadow.glow(theme.accent) }]}
          >
            <MaterialCommunityIcons name="dice-5-outline" size={22} color={theme.accentText} />
            <Text style={[styles.pickText, { color: theme.accentText }]} numberOfLines={1}>
              CAN’T DECIDE? PICK FOR ME
            </Text>
          </Tap>
          <View style={styles.toolbar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flex: 1 }}>
              <Chip theme={theme} label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip theme={theme} label="Films" color={KIND_COLORS.movie} active={filter === 'movie'} onPress={() => setFilter('movie')} />
              <Chip theme={theme} label="Series" color={KIND_COLORS.tv} active={filter === 'tv'} onPress={() => setFilter('tv')} />
              <Chip theme={theme} label="Anime" color={KIND_COLORS.anime} active={filter === 'anime'} onPress={() => setFilter('anime')} />
            </ScrollView>
          </View>
          <Pressable onPress={() => setSort(SORTS[sort].next)} hitSlop={16} accessibilityRole="button" style={styles.sortBtn}>
            <Ionicons name="swap-vertical" size={14} color={theme.textMuted} />
            <Text style={[styles.sortText, { color: theme.textMuted }]}>{SORTS[sort].label.toUpperCase()}</Text>
          </Pressable>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={view === 'next' ? shown : []}
        refreshControl={pull}
        key={COLS}
        numColumns={COLS}
        keyExtractor={(w) => w.id}
        ListHeaderComponent={header}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        renderItem={({ item, index }) => (
          <Rise order={index} style={{ width: tile }}>
          <Tap
            // A tap opens the title's page (where you can plan a watch); a long press, the quick menu.
            onPress={() => (item.source === 'tmdb' && item.sourceId ? openTitle(titleOf(item)) : setMenu(item))}
            onLongPress={() => setMenu(item)}
            accessibilityRole="button"
            accessibilityHint="Long press for more"
            accessibilityLabel={`${item.title}${item.year ? `, ${item.year}` : ''}${sort === 'runtime' ? `, ${runtimeLabel(item) ?? 'running time not known'}` : ''}`}
          >
            <Poster uri={item.posterUrl} title={item.title} width={tile} theme={theme} radius={6} />
            <Text style={[styles.tileTitle, { color: theme.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.tileMeta, { color: theme.textMuted }]} numberOfLines={1}>
              <Text style={{ color: KIND_COLORS[item.kind] }}>● </Text>
              {(sort === 'runtime' ? runtimeLabel(item) : item.year) ?? '—'}
            </Text>
            {(() => {
              const night = forTitle(item.sourceId);
              return night ? (
                <Text style={[styles.tileNight, { color: theme.accent }]} numberOfLines={1}>
                  {nightLabel(night.at)}
                </Text>
              ) : null;
            })()}
          </Tap>
          </Rise>
        )}
        ListEmptyComponent={
          view !== 'next' ? undefined : queue.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
                <MaterialCommunityIcons name="bookmark-multiple-outline" size={38} color={theme.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>NOTHING QUEUED UP</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Tap the bookmark on any title to save it here
              </Text>
              <Pressable onPress={() => router.navigate('/search')} style={[styles.emptyBtn, { backgroundColor: theme.accent }]} accessibilityRole="button">
                <Text style={[styles.emptyBtnText, { color: theme.accentText }]}>FIND A TITLE</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: theme.textMuted, marginTop: 24 }]}>Nothing of that kind on your list.</Text>
          )
        }
      />

      <ActionSheet
        visible={menu !== null}
        title={menu ? `${menu.title}${menu.year ? ` (${menu.year})` : ''}${menu.note ? `\n${menu.note}` : ''}` : undefined}
        onClose={() => setMenu(null)}
        actions={
          menu
            ? [
                ...(menu.source === 'tmdb' && menu.sourceId ? [{ label: 'Open the title page', icon: 'open-outline' as const, onPress: () => openTitle(titleOf(menu)) }] : []),
                { label: 'Plan a watch', icon: 'calendar-outline' as const, onPress: () => setPlanning(menu) },
                { label: 'Watched it: log now', icon: 'checkmark-done-outline', onPress: () => log(menu) },
                { label: 'Add to a list', icon: 'albums-outline' as const, onPress: () => setListing(menu) },
                ...(trackable(menu)
                  ? [{ label: 'Track episodes', icon: 'list-outline' as const, onPress: () => router.push({ pathname: '/track', params: { id: menu.id } }) }]
                  : []),
                { label: 'Take off watchlist', icon: 'bookmark-outline', destructive: true, onPress: () => remove(menu) },
              ]
            : []
        }
      />

      <AddToList item={listing} theme={theme} onClose={() => setListing(null)} />
      {planning && <MovieNightSheet t={titleOf(planning)} visible theme={theme} onClose={() => setPlanning(null)} />}
      <NextWatch
        theme={theme}
        item={pick}
        onClose={() => setPick(null)}
        onSpin={spin}
        rolling={rolling}
        tile={tile}
        onLog={(w) => (setPick(null), log(w))}
        canSpin={shown.length > 1}
      />
    </View>
  );
}

/** The roulette's result, presented like the main feature. */
function NextWatch({
  theme,
  item,
  onClose,
  onSpin,
  onLog,
  canSpin,
  rolling,
  tile,
}: {
  theme: Theme;
  item: WatchItem | null;
  onClose: () => void;
  onSpin: () => void;
  onLog: (w: WatchItem) => void;
  canSpin: boolean;
  rolling: boolean;
  tile: number;
}) {
  const { height } = useWindowDimensions();
  // Room for the card on a short phone; the title and buttons must never be pushed off it.
  const poster = Math.min(150, Math.round(height * 0.2));
  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose}>
        {item && (
          <View style={[styles.feature, { backgroundColor: theme.card, borderColor: theme.accent + '66' }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.featureKicker, { color: theme.accent }]}>★ YOUR NEXT WATCH ★</Text>
            <Pop when={rolling ? 'rolling' : item.id}>
              {/* While it rolls, the tile-sized poster: already loaded, so nothing flashes blank. */}
              <Pressable
                onPress={() => item.source === 'tmdb' && item.sourceId && (onClose(), openTitle(titleOf(item)))}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.title}`}
                style={{ width: poster, height: poster * 1.5, alignItems: 'center', justifyContent: 'center' }}
              >
                {rolling ? (
                  <Poster uri={item.posterUrl} title={item.title} width={tile} theme={theme} radius={8} style={{ transform: [{ scale: poster / tile }] }} />
                ) : (
                  <Poster uri={item.posterUrl} title={item.title} width={poster} theme={theme} radius={8} style={{ boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }} />
                )}
              </Pressable>
            </Pop>
            <KindBadge kind={item.kind} theme={theme} />
            <Text style={[styles.featureTitle, { color: theme.text }]} numberOfLines={2}>
              {item.title.toUpperCase()}
            </Text>
            {!!item.year && (
              <Text style={[styles.featureMeta, { color: theme.textMuted }]} numberOfLines={2}>
                {item.year}
                {item.credit ? ` · ${item.credit}` : ''}
              </Text>
            )}
            {!!item.note && (
              <Text style={[styles.featureMeta, { color: theme.textMuted }]} numberOfLines={2}>
                “{item.note}”
              </Text>
            )}
            <View style={styles.featureButtons}>
              <Tap onPress={() => onLog(item)} disabled={rolling} style={[styles.featureBtn, { backgroundColor: theme.accent }]} accessibilityRole="button">
                <MaterialCommunityIcons name="movie-open-check-outline" size={18} color={theme.accentText} />
                <Text style={[styles.featureBtnText, { color: theme.accentText }]}>WATCHED IT</Text>
              </Tap>
              {canSpin && (
                <Tap onPress={onSpin} disabled={rolling} style={[styles.featureBtn, { borderColor: theme.border, borderWidth: 1 }]} accessibilityRole="button">
                  <MaterialCommunityIcons name="dice-5-outline" size={18} color={theme.text} />
                  <Text style={[styles.featureBtnText, { color: theme.text }]}>SPIN AGAIN</Text>
                </Tap>
              )}
            </View>
          </View>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: 16, gap: 18 },
  top: { gap: 12, marginBottom: 2 },
  heading: { fontFamily: fonts.display, fontSize: font.marquee, lineHeight: 46, letterSpacing: 1, includeFontPadding: false },
  // The gold word is a span a little taller than the line; the gap keeps it off the line below.
  titleBlock: { flex: 1, gap: 4 },
  sub: { fontFamily: fonts.mono, fontSize: font.footnote },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 50, borderRadius: 25 },
  pickText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.2 },
  toolbar: { flexDirection: 'row', alignItems: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  listsBtn: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: 16, borderRadius: 23, borderWidth: 1.5 },
  listsText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 0.8 },
  chips: { gap: 8 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end' },
  sortText: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 1 },
  tileTitle: { fontSize: font.footnote, fontWeight: '700', marginTop: 6, lineHeight: 17 },
  tileNight: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 0.5, marginTop: 1 },
  tileMeta: { fontFamily: fonts.mono, fontSize: font.caption, marginTop: 2 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 50, paddingHorizontal: 24 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 30, letterSpacing: 1.5 },
  emptyText: { fontFamily: fonts.mono, fontSize: font.body, textAlign: 'center', lineHeight: 21 },
  emptyBtn: { height: 44, paddingHorizontal: 20, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  emptyBtnText: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  feature: { width: '100%', maxWidth: 380, borderRadius: 20, borderWidth: 1, padding: 22, alignItems: 'center', gap: 10 },
  featureKicker: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 3 },
  featureTitle: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34, textAlign: 'center', letterSpacing: 1 },
  featureMeta: { fontFamily: fonts.mono, fontSize: font.footnote, textAlign: 'center' },
  featureButtons: { gap: 8, marginTop: 8, alignSelf: 'stretch' },
  featureBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23 },
  featureBtnText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
});
