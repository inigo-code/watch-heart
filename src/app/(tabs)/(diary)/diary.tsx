import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyScene } from '@/components/EmptyScene';
import { Text, TextInput } from '@/components/AppText';
import { CineIcon } from '@/components/CineIcon';
import { usePullRefresh } from '@/components/PullRefresh';
import { ActionSheet } from '@/components/ActionSheet';
import { AddToList } from '@/components/lists/AddToList';
import { ConfirmTrash } from '@/components/ConfirmTrash';
import { dayWords, useDaySheet } from '@/components/DaySheet';
import { PosterTile, ReelHeader, TicketStub } from '@/components/Diary';
import { Chip } from '@/components/Film';
import { TipCard } from '@/components/TipCard';
import { useToast } from '@/components/Toast';
import { MONTHS, friendlyDate, monthKey, today } from '@/lib/dates';
import { plainText } from '@/lib/richText';
import { hasReview } from '@/lib/review';
import { useHaptic } from '@/lib/haptics';
import { computeStats } from '@/lib/stats';
import { useTracker } from '@/lib/useTracker';
import { KIND_COLORS, font, fonts, shadow, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import { useSync } from '@/sync/SyncProvider';
import type { Entry } from '@/store/types';

type Filter = 'all' | 'movie' | 'tv' | 'anime' | 'liked' | 'reviewed' | 'rewatch';

const FILTERS: { key: Filter; label: string; color?: string; icon?: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All' },
  { key: 'movie', label: 'Films', color: KIND_COLORS.movie },
  { key: 'tv', label: 'Series', color: KIND_COLORS.tv },
  { key: 'anime', label: 'Anime', color: KIND_COLORS.anime },
  { key: 'liked', label: 'Liked', icon: 'heart' },
  { key: 'reviewed', label: 'Reviewed', icon: 'reader-outline' },
  { key: 'rewatch', label: 'Rewatches', icon: 'repeat' },
];

/** Section key for undated entries (sorts after every month). */
const ARCHIVE = 'archive';

const GRID_COLS = 4;
const GAP = 10;

function matches(e: Entry, filter: Filter, q: string) {
  if (filter === 'movie' || filter === 'tv' || filter === 'anime') {
    if (e.kind !== filter) return false;
  } else if (filter === 'liked' && !e.liked) return false;
  else if (filter === 'reviewed' && !hasReview(e)) return false;
  else if (filter === 'rewatch' && !e.rewatch) return false;
  if (!q) return true;
  return searchText(e).includes(q.replace(/\s+/g, ' '));
}

// What search reads, made once per version of an entry (an edit makes a new object), so typing stays quick
// with thousands of entries: the review without its formatting marks, and the release year.
const searched = new WeakMap<Entry, string>();
function searchText(e: Entry) {
  let hay = searched.get(e);
  if (hay === undefined) {
    hay = `${e.title} ${e.originalTitle ?? ''} ${e.year ?? ''} ${e.heading ?? ''} ${plainText(e.review)} ${e.tags.join(' ')} ${e.credit ?? ''} ${e.progress} ${(e.companions ?? []).join(' ')}`
      .replace(/\s+/g, ' ')
      .toLowerCase();
    searched.set(e, hay);
  }
  return hay;
}

export default function DiaryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { settings, update } = useSettings();
  const { entries, ready, deleteEntry, restoreEntry, updateEntry } = useDiary();
  const tracker = useTracker();
  // "Change the date" on an entry's menu: its episodes on the tracker move with it.
  const days = useDaySheet();
  const redate = (e: Entry) =>
    days.ask({ title: `${e.title}\n${e.undated ? 'Date unknown' : `Watched ${friendlyDate(e.watchedOn)}`}` }, (d) => {
      tracker.redate(e, d);
      updateEntry(e.id, { watchedOn: d.undated ? e.watchedOn : d.watchedOn, undated: d.undated ? true : undefined });
      toast(`Moved to ${dayWords(d)}`);
    });
  const sync = useSync();
  const pull = usePullRefresh(theme, () => sync.syncNow());
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  // Opened on a search from elsewhere (a name on an entry, a movie buddy): show it.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [seenQ, setSeenQ] = useState<string | undefined>(undefined);
  if (q !== seenQ) {
    setSeenQ(q);
    if (q) setQuery(q);
  }
  const [menu, setMenu] = useState<Entry | null>(null);
  const [trashing, setTrashing] = useState<Entry | null>(null);
  const [listing, setListing] = useState<Entry | null>(null);
  const listRef = useRef<SectionList<Entry[], { month: string; count: number; data: Entry[][] }>>(null);
  const grid = settings.diaryLayout === 'grid';
  const tile = (width - 32 - GAP * (GRID_COLS - 1)) / GRID_COLS;

  const year = today().slice(0, 4);
  const thisYear = useMemo(() => entries.filter((e) => !e.undated && e.watchedOn.startsWith(year)), [entries, year]);
  const yearStats = useMemo(() => computeStats(thisYear), [thisYear]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const months = new Map<string, Entry[]>();
    for (const e of entries) {
      if (!matches(e, filter, q)) continue;
      // Imports without a watch date (an old MyAnimeList list, say) share one reel at the end.
      const k = e.undated ? ARCHIVE : monthKey(e.watchedOn);
      months.set(k, [...(months.get(k) ?? []), e]);
    }
    return [...months.entries()]
      .sort(([a], [b]) => (a === ARCHIVE ? 1 : b === ARCHIVE ? -1 : 0))
      .map(([month, list]) => ({
        month,
        count: list.length,
        // The poster wall lays a month out in rows; the ticket list has one entry per row.
        data: grid
          ? Array.from({ length: Math.ceil(list.length / GRID_COLS) }, (_, i) => list.slice(i * GRID_COLS, (i + 1) * GRID_COLS))
          : list.map((e) => [e]),
      }));
  }, [entries, filter, query, grid]);

  const remove = (e: Entry) => {
    deleteEntry(e.id);
    toast(`Moved “${e.title}” to Trash`, { label: 'Undo', onPress: () => restoreEntry(e.id) });
  };

  const showTip = ready && entries.length > 0 && !settings.dismissedTips.includes('reel-story');
  const dismissTip = () => update({ dismissedTips: [...settings.dismissedTips, 'reel-story'] });
  const hours = Math.round(yearStats.minutes / 60);

  const header = (
    <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
      <Text maxFontSizeMultiplier={1.15} style={[styles.heading, { color: theme.text }]} accessibilityRole="header">
        YOUR <Text style={{ color: theme.accent }}>DIARY</Text>
      </Text>

      {entries.length > 0 && (
        <View style={[styles.search, { backgroundColor: theme.chip }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your diary"
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      {entries.length > 0 && (
        <View style={styles.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
            {FILTERS.map((f) => (
              <Chip key={f.key} theme={theme} label={f.label} color={f.color} icon={f.icon} active={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </ScrollView>
          <Pressable
            onPress={() => update({ diaryLayout: grid ? 'list' : 'grid' })}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={grid ? 'Show as tickets' : 'Show as poster wall'}
            style={({ pressed }) => [styles.layoutBtn, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name={grid ? 'list' : 'grid'} size={18} color={theme.text} />
          </Pressable>
        </View>
      )}
    </View>
  );

  const tip = showTip ? (
    <View style={styles.tip}>
      <TipCard theme={theme} title="Every month is a reel" onDismiss={dismissTip}>
        Tap STORY to share a month. Hold a ticket for more.
      </TipCard>
    </View>
  ) : null;

  // A month's bar takes the list to that month. The list only draws rows near where it is, so the rows down
  // to that month are drawn first (rows at the start of the list stay drawn once they are). Then the month's
  // header is measured where it actually is, rather than where the list estimates it, and the list scrolls
  // there. Waiting for it to be drawn stops after a few seconds, or as soon as you take hold of the list.
  const [reach, setReach] = useState(8);
  const reels = useRef(new Map<string, ComponentRef<typeof View>>());
  const jumping = useRef({ month: '', id: 0 });
  const jump = (key: string) => {
    const section = sections.findIndex((s) => s.month === key);
    if (section < 0) return;
    // A section is its header, its rows and its footer; then a screenful past the header.
    const header = sections.slice(0, section).reduce((n, s) => n + s.data.length + 2, 0);
    setReach((r) => Math.max(r, header + 12));
    const id = jumping.current.id + 1;
    jumping.current = { month: key, id };
    const go = (left: number) => {
      if (jumping.current.id !== id || !jumping.current.month) return;
      const reel = reels.current.get(key);
      const scroller = listRef.current?.getScrollResponder();
      const content = scroller?.getInnerViewRef();
      const retry = () => left > 0 && setTimeout(() => go(left - 1), 100);
      if (!reel || !scroller || !content) return void retry();
      reel.measureLayout(content, (_x, y) => scroller.scrollTo({ y, animated: true }), retry);
    };
    setTimeout(() => go(40), 0);
  };
  const stopJump = () => {
    jumping.current.month = '';
  };
  const shownMonths = useMemo(() => new Set(sections.map((s) => s.month)), [sections]);

  // While searching, the results come first.
  const strip =
    entries.length > 0 && !query.trim() ? (
      <YearStrip theme={theme} year={year} entries={thisYear} hours={hours} stats={yearStats} shown={shownMonths} onJump={jump} />
    ) : null;
  const listHeader = strip || tip ? (
    <>
      {strip}
      {tip}
    </>
  ) : undefined;

  const rows = sections.reduce((n, sec) => n + sec.data.length, 0);
  const first = sections[0]?.data[0]?.[0];
  const toTop = () => listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, viewOffset: 80, animated: true });
  // At the end of a long diary (the oldest entry): a way back up to the newest.
  const footer =
    rows > 6 && first ? (
      <View style={styles.end}>
        <Text style={[styles.endText, { color: theme.textMuted }]}>
          {filter === 'all' && !query.trim() ? 'You’ve reached the beginning' : 'That’s all of them'}
        </Text>
        <Pressable
          onPress={toTop}
          accessibilityRole="button"
          accessibilityLabel={`Back to the top, to ${first.title}`}
          style={({ pressed }) => [styles.endBtn, { borderColor: theme.border, backgroundColor: pressed ? theme.chip : 'transparent' }]}
        >
          <Ionicons name="arrow-up" size={18} color={theme.accent} />
          <Text style={[styles.endBtnText, { color: theme.text }]}>Back to the top</Text>
        </Pressable>
      </View>
    ) : undefined;

  return (
    <View style={styles.screen}>
      {header}
      <SectionList
        ref={listRef}
        refreshControl={pull}
        style={styles.scroller}
        sections={sections}
        keyExtractor={(row) => row.map((e) => e.id).join('|')}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // A screenful first, then the rest in small batches, so a long diary opens at once (a month's bar
        // raises it to that month).
        initialNumToRender={reach}
        maxToRenderPerBatch={8}
        windowSize={9}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
        renderSectionHeader={({ section }) => (
          <View
            collapsable={false}
            ref={(v) => {
              if (!v) return;
              reels.current.set(section.month, v);
              return () => {
                if (reels.current.get(section.month) === v) reels.current.delete(section.month);
              };
            }}
          >
            <ReelHeader
              month={section.month}
              count={section.count}
              theme={theme}
              onShare={() => router.navigate({ pathname: '/recap', params: { period: section.month } })}
            />
          </View>
        )}
        renderItem={({ item: row }) =>
          grid ? (
            <View style={[styles.gridRow, { marginTop: GAP }]}>
              {row.map((e) => (
                <PosterTile key={e.id} entry={e} theme={theme} width={tile} onPress={() => router.push({ pathname: '/entry/[id]', params: { id: e.id } })} />
              ))}
            </View>
          ) : (
            <View style={{ marginTop: 10 }}>
              <TicketStub
                entry={row[0]}
                theme={theme}
                onPress={() => router.push({ pathname: '/entry/[id]', params: { id: row[0].id } })}
                onLongPress={() => setMenu(row[0])}
              />
            </View>
          )
        }
        ListFooterComponent={footer}
        onScrollToIndexFailed={() => {}}
        onScrollBeginDrag={stopJump}
        ListEmptyComponent={
          !ready ? undefined : entries.length === 0 ? (
            <EmptyScene
              theme={theme}
              scene="ticket"
              title="The screen is dark"
              text="Log the last film, series or anime you watched, and your diary starts rolling."
              action={{ label: 'Find a title', icon: 'find', onPress: () => router.navigate('/search') }}
            />
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No matches</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>Try another search or filter.</Text>
            </View>
          )
        }
      />

      {entries.length > 0 && (
        <Pressable
          onPress={() => router.navigate('/search')}
          accessibilityRole="button"
          accessibilityLabel="Log something you watched"
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: theme.accent, bottom: 20, boxShadow: shadow.raised, transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
        >
          <CineIcon name="log" size={28} color={theme.accentText} />
        </Pressable>
      )}

      <ActionSheet
        visible={menu !== null}
        title={menu ? `${menu.title}${menu.year ? ` (${menu.year})` : ''}` : undefined}
        onClose={() => setMenu(null)}
        actions={
          menu
            ? [
                { label: 'Edit entry', icon: 'create-outline', onPress: () => router.push({ pathname: '/log', params: { id: menu.id } }) },
                { label: 'Change the date', icon: 'calendar-outline', onPress: () => redate(menu) },
                { label: 'Log again', icon: 'repeat', onPress: () => router.push({ pathname: '/log', params: { again: menu.id } }) },
                { label: 'Share as story card', icon: 'sparkles-outline', onPress: () => router.push({ pathname: '/card/[id]', params: { id: menu.id } }) },
                { label: 'Add to a list', icon: 'albums-outline', onPress: () => setListing(menu) },
                ...(menu.source === 'tmdb' && menu.sourceId
                  ? [{ label: 'Choose a poster', icon: 'images-outline' as const, onPress: () => router.push({ pathname: '/poster/[id]', params: { id: menu.id } }) }]
                  : []),
                { label: 'Move to Trash', icon: 'trash-outline', destructive: true, onPress: () => setTrashing(menu) },
              ]
            : []
        }
      />
      <AddToList item={listing} theme={theme} onClose={() => setListing(null)} />
      <ConfirmTrash title={trashing?.title ?? null} onConfirm={() => trashing && remove(trashing)} onClose={() => setTrashing(null)} />
      {days.sheet}
    </View>
  );
}

/** This year at a glance: four figures, then a bar per month that takes you to that month. */
function YearStrip({
  theme,
  year,
  entries,
  hours,
  stats,
  shown,
  onJump,
}: {
  theme: Theme;
  year: string;
  entries: Entry[];
  hours: number;
  stats: ReturnType<typeof computeStats>;
  shown: Set<string>;
  onJump: (month: string) => void;
}) {
  const haptic = useHaptic();
  const months = useMemo(() => {
    const out = new Array<number>(12).fill(0);
    entries.forEach((e) => out[Number(e.watchedOn.slice(5, 7)) - 1]++);
    return out;
  }, [entries]);
  const max = Math.max(1, ...months);
  const thisMonth = Number(today().slice(5, 7)) - 1;
  return (
    <View style={[styles.marquee, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <View style={styles.marqueeRow}>
        <MarqueeStat theme={theme} value={String(stats.total)} label={`In ${year}`} />
        <View style={[styles.marqueeRule, { backgroundColor: theme.border }]} />
        <MarqueeStat theme={theme} value={`${hours}h`} label="Watched" />
        <View style={[styles.marqueeRule, { backgroundColor: theme.border }]} />
        <MarqueeStat theme={theme} value={stats.avgStars ? `${stats.avgStars}★` : '—'} label="Average" />
        <View style={[styles.marqueeRule, { backgroundColor: theme.border }]} />
        <MarqueeStat theme={theme} value={String(stats.liked)} label="Loved" />
      </View>
      <View style={styles.months}>
        {months.map((n, i) => {
          const key = `${year}-${String(i + 1).padStart(2, '0')}`;
          const ahead = i > thisMonth;
          const open = n > 0 && shown.has(key);
          return (
            <Pressable
              key={key}
              disabled={!open}
              onPress={() => {
                haptic('step');
                onJump(key);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${MONTHS[i]}, ${n} ${n === 1 ? 'entry' : 'entries'}`}
              accessibilityState={{ disabled: !open }}
              style={styles.month}
            >
              {({ pressed }) => (
                <>
                  <View style={[styles.track, ahead ? { borderWidth: 1, borderColor: theme.border } : { backgroundColor: theme.chip }]}>
                    {n > 0 && (
                      <View
                        style={[
                          styles.fill,
                          { height: `${Math.max(8, (n / max) * 100)}%`, backgroundColor: pressed ? theme.text : theme.textMuted, opacity: open ? 1 : 0.4 },
                        ]}
                      />
                    )}
                  </View>
                  <Text allowFontScaling={false} style={[styles.monthLetter, { color: i === thisMonth ? theme.text : theme.textMuted }]}>
                    {MONTHS[i][0]}
                  </Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MarqueeStat({ theme, value, label }: { theme: ReturnType<typeof useTheme>; value: string; label: string }) {
  return (
    <View style={styles.marqueeStat}>
      <Text style={[styles.marqueeValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.marqueeLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: 16 },
  heading: { fontFamily: fonts.display, fontSize: font.marquee, lineHeight: 46, letterSpacing: 1, includeFontPadding: false },
  // The header sits above the list, so it carries the list's side padding itself.
  top: { gap: 12, paddingBottom: 6, paddingHorizontal: 16 },
  scroller: { flex: 1 },
  tip: { paddingTop: 10 },
  marquee: { borderWidth: 1, borderRadius: 12, paddingTop: 10, paddingBottom: 8, gap: 12, marginTop: 4, marginBottom: 2 },
  marqueeRow: { flexDirection: 'row', alignItems: 'center' },
  months: { flexDirection: 'row', gap: 4, height: 64, paddingHorizontal: 10 },
  month: { flex: 1, gap: 4 },
  track: { flex: 1, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  fill: { width: '100%', borderRadius: 4 },
  monthLetter: { fontFamily: fonts.uiSemibold, fontSize: 11, lineHeight: 14, textAlign: 'center' },
  marqueeStat: { flex: 1, alignItems: 'center' },
  marqueeValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, includeFontPadding: false },
  marqueeLabel: { fontFamily: fonts.uiSemibold, fontSize: 12 },
  marqueeRule: { width: 1, alignSelf: 'stretch' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: font.body, height: '100%' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // The chips' row is 16 taller than it looks, so their 48dp touch area isn't cut off by the scroller.
  chipScroll: { flex: 1, marginVertical: -8 },
  chips: { gap: 8, paddingRight: 8, paddingVertical: 8 },
  layoutBtn: { width: 40, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  gridRow: { flexDirection: 'row', gap: GAP },
  empty: { alignItems: 'center', gap: 10, paddingTop: 64, paddingHorizontal: 28 },
  end: { alignItems: 'center', gap: 12, paddingTop: 36, paddingBottom: 8 },
  endText: { fontFamily: fonts.ui, fontSize: font.footnote },
  endBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 20, borderRadius: 22, borderWidth: 1 },
  endBtnText: { fontFamily: fonts.uiSemibold, fontSize: font.footnote },
  emptyTitle: { fontFamily: fonts.uiBold, fontSize: font.title2 },
  emptyText: { fontFamily: fonts.ui, fontSize: font.body, textAlign: 'center', lineHeight: 21 },
  fab: { position: 'absolute', right: 20, width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
});
