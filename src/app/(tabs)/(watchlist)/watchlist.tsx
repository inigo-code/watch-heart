import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { trackable } from '@/api/episodes';
import { ScreenGlow } from '@/components/ScreenGlow';
import { ActionSheet } from '@/components/ActionSheet';
import { ContinueWatching } from '@/components/ContinueWatching';
import { AddToList } from '@/components/lists/AddToList';
import { nightLabel, useMovieNights } from '@/components/MovieNight';
import { Chip, KindBadge, Poster } from '@/components/Film';
import { useToast } from '@/components/Toast';
import { KIND_COLORS, font, fonts, shadow, useTheme } from '@/lib/theme';
import { useLists } from '@/lists/ListsProvider';
import type { Theme } from '@/lib/theme';
import { titleOf, useDiary } from '@/store/DiaryStore';
import type { MediaKind, WatchItem } from '@/store/types';

type Filter = 'all' | MediaKind;
type Sort = 'added' | 'title' | 'year';

const SORTS: Record<Sort, { label: string; next: Sort }> = {
  added: { label: 'Recently added', next: 'title' },
  title: { label: 'A–Z', next: 'year' },
  year: { label: 'Newest release', next: 'added' },
};

const COLS = 3;
const GAP = 12;

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
  const { lists } = useLists();
  const tile = (width - 32 - GAP * (COLS - 1)) / COLS;

  const queue = useMemo(() => watchlist.filter((w) => !w.track), [watchlist]);
  const shown = useMemo(() => {
    const list = queue.filter((w) => filter === 'all' || w.kind === filter);
    if (sort === 'title') return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'year') return [...list].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    return list;
  }, [queue, filter, sort]);

  const log = (w: WatchItem) => router.push({ pathname: '/log', params: { title: JSON.stringify(titleOf(w)) } });
  const remove = (w: WatchItem) => {
    removeFromWatchlist(w.id);
    toast(`Took “${w.title}” off your watchlist`, { label: 'Undo', onPress: () => importWatchlist([w]) });
  };
  // Never the same title twice in a row, when there's a choice.
  const spin = () => {
    const pool = shown.length > 1 && pick ? shown.filter((w) => w.id !== pick.id) : shown;
    setPick(pool[Math.floor(Math.random() * pool.length)] ?? null);
  };

  const header = (
    <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
      <ContinueWatching items={watchlist} theme={theme} />
      <View style={styles.headRow}>
        <View style={styles.titleBlock}>
          <Text maxFontSizeMultiplier={1.15} style={[styles.heading, { color: theme.text }]}>
            UP <Text style={{ color: theme.accent }}>NEXT</Text>
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            {queue.length ? `${queue.length} ${queue.length === 1 ? 'title' : 'titles'} on your watchlist` : 'Your watchlist'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/lists')}
          accessibilityRole="button"
          accessibilityLabel="Your lists"
          style={({ pressed }) => [styles.listsBtn, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="albums-outline" size={16} color={theme.accent} />
          <Text style={[styles.listsText, { color: theme.text }]}>LISTS{lists.length ? ` · ${lists.length}` : ''}</Text>
        </Pressable>
      </View>
      {queue.length > 0 && (
        <>
          <Pressable
            onPress={spin}
            disabled={!shown.length}
            accessibilityRole="button"
            style={({ pressed }) => [styles.pickBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1, boxShadow: shadow.glow(theme.accent) }]}
          >
            <MaterialCommunityIcons name="dice-5-outline" size={22} color={theme.accentText} />
            <Text style={[styles.pickText, { color: theme.accentText }]}>CAN’T DECIDE? PICK FOR ME</Text>
          </Pressable>
          <View style={styles.toolbar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flex: 1 }}>
              <Chip theme={theme} label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip theme={theme} label="Films" color={KIND_COLORS.movie} active={filter === 'movie'} onPress={() => setFilter('movie')} />
              <Chip theme={theme} label="Series" color={KIND_COLORS.tv} active={filter === 'tv'} onPress={() => setFilter('tv')} />
              <Chip theme={theme} label="Anime" color={KIND_COLORS.anime} active={filter === 'anime'} onPress={() => setFilter('anime')} />
            </ScrollView>
          </View>
          <Pressable onPress={() => setSort(SORTS[sort].next)} hitSlop={8} accessibilityRole="button" style={styles.sortBtn}>
            <Ionicons name="swap-vertical" size={14} color={theme.textMuted} />
            <Text style={[styles.sortText, { color: theme.textMuted }]}>{SORTS[sort].label.toUpperCase()}</Text>
          </Pressable>
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScreenGlow theme={theme} />
      <FlatList
        data={shown}
        key={COLS}
        numColumns={COLS}
        keyExtractor={(w) => w.id}
        ListHeaderComponent={header}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setMenu(item)}
            onLongPress={() => setMenu(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}${item.year ? `, ${item.year}` : ''}`}
            style={({ pressed }) => [{ width: tile, opacity: pressed ? 0.8 : 1 }]}
          >
            <Poster uri={item.posterUrl} title={item.title} width={tile} theme={theme} radius={6} />
            <Text style={[styles.tileTitle, { color: theme.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.tileMeta, { color: theme.textMuted }]} numberOfLines={1}>
              <Text style={{ color: KIND_COLORS[item.kind] }}>● </Text>
              {item.year ?? '—'}
            </Text>
            {(() => {
              const night = forTitle(item.sourceId);
              return night ? (
                <Text style={[styles.tileNight, { color: theme.accent }]} numberOfLines={1}>
                  {nightLabel(night.at)}
                </Text>
              ) : null;
            })()}
          </Pressable>
        )}
        ListEmptyComponent={
          queue.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
                <MaterialCommunityIcons name="bookmark-multiple-outline" size={38} color={theme.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>NOTHING QUEUED UP</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                Tap the bookmark on any title in Find to save it for later. Share links from IMDb, Letterboxd or AniList work too.
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
      <TonightsFeature
        theme={theme}
        item={pick}
        onClose={() => setPick(null)}
        onSpin={spin}
        onLog={(w) => (setPick(null), log(w))}
        canSpin={shown.length > 1}
      />
    </View>
  );
}

/** The roulette's result, presented like the night's main feature. */
function TonightsFeature({
  theme,
  item,
  onClose,
  onSpin,
  onLog,
  canSpin,
}: {
  theme: Theme;
  item: WatchItem | null;
  onClose: () => void;
  onSpin: () => void;
  onLog: (w: WatchItem) => void;
  canSpin: boolean;
}) {
  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose}>
        {item && (
          <View style={[styles.feature, { backgroundColor: theme.card, borderColor: theme.accent + '66' }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.featureKicker, { color: theme.accent }]}>★ TONIGHT’S FEATURE ★</Text>
            <Poster uri={item.posterUrl} title={item.title} width={150} theme={theme} radius={8} style={{ boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }} />
            <KindBadge kind={item.kind} theme={theme} />
            <Text style={[styles.featureTitle, { color: theme.text }]} numberOfLines={3}>
              {item.title.toUpperCase()}
            </Text>
            {!!item.year && (
              <Text style={[styles.featureMeta, { color: theme.textMuted }]}>
                {item.year}
                {item.credit ? ` · ${item.credit}` : ''}
              </Text>
            )}
            {!!item.note && <Text style={[styles.featureMeta, { color: theme.textMuted }]}>“{item.note}”</Text>}
            <View style={styles.featureButtons}>
              {canSpin && (
                <Pressable onPress={onSpin} style={[styles.featureBtn, { borderColor: theme.border, borderWidth: 1 }]} accessibilityRole="button">
                  <MaterialCommunityIcons name="dice-5-outline" size={18} color={theme.text} />
                  <Text style={[styles.featureBtnText, { color: theme.text }]}>SPIN AGAIN</Text>
                </Pressable>
              )}
              <Pressable onPress={() => onLog(item)} style={[styles.featureBtn, { backgroundColor: theme.accent }]} accessibilityRole="button">
                <MaterialCommunityIcons name="movie-open-check-outline" size={18} color={theme.accentText} />
                <Text style={[styles.featureBtnText, { color: theme.accentText }]}>WATCHED IT</Text>
              </Pressable>
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
  titleBlock: { gap: 4 },
  sub: { fontFamily: fonts.mono, fontSize: font.footnote },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 50, borderRadius: 25 },
  pickText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.2 },
  toolbar: { flexDirection: 'row', alignItems: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  listsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1 },
  listsText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  chips: { gap: 8 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end' },
  sortText: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1 },
  tileTitle: { fontSize: font.footnote, fontWeight: '700', marginTop: 6, lineHeight: 17 },
  tileNight: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 0.5, marginTop: 1 },
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
  featureButtons: { flexDirection: 'row', gap: 10, marginTop: 6, alignSelf: 'stretch' },
  featureBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23 },
  featureBtnText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
});
