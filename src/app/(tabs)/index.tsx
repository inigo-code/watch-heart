import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ActionSheet';
import { Avatar } from '@/components/Avatar';
import { AddToList } from '@/components/lists/AddToList';
import { BrandTitle } from '@/components/BrandTitle';
import { PosterTile, ReelHeader, TicketStub } from '@/components/Diary';
import { Chip } from '@/components/Film';
import { TipCard } from '@/components/TipCard';
import { useToast } from '@/components/Toast';
import { monthKey, today } from '@/lib/dates';
import { useHour } from '@/lib/greeting';
import { computeStats } from '@/lib/stats';
import { KIND_COLORS, font, fonts, shadow, useTheme } from '@/lib/theme';
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

/** A line under the title that changes with the hour, like the next showing on a marquee. */
function tagline(hour: number, name: string) {
  const who = name.trim() ? `, ${name.trim()}` : '';
  if (hour >= 5 && hour < 12) return `Morning${who}. Coffee and a classic?`;
  if (hour >= 12 && hour < 17) return `Afternoon${who}. Matinee time.`;
  if (hour >= 17 && hour < 22) return `Evening${who}. Lights down, phones away.`;
  return `Still up${who}? One more episode…`;
}

function matches(e: Entry, filter: Filter, q: string) {
  if (filter === 'movie' || filter === 'tv' || filter === 'anime') {
    if (e.kind !== filter) return false;
  } else if (filter === 'liked' && !e.liked) return false;
  else if (filter === 'reviewed' && !e.review.trim()) return false;
  else if (filter === 'rewatch' && !e.rewatch) return false;
  if (!q) return true;
  const hay =
    `${e.title} ${e.originalTitle ?? ''} ${e.review} ${e.tags.join(' ')} ${e.credit ?? ''} ${e.progress} ${(e.companions ?? []).join(' ')}`.toLowerCase();
  return hay.includes(q);
}

export default function DiaryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const hour = useHour();
  const { width } = useWindowDimensions();
  const { settings, update } = useSettings();
  const sync = useSync();
  const { entries, ready, deleteEntry, restoreEntry } = useDiary();
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
  const [listing, setListing] = useState<Entry | null>(null);
  const listRef = useRef<SectionList<Entry[], { month: string; count: number; data: Entry[][] }>>(null);
  const grid = settings.diaryLayout === 'grid';
  const tile = (width - 32 - GAP * (GRID_COLS - 1)) / GRID_COLS;

  const yearStats = useMemo(() => computeStats(entries.filter((e) => !e.undated && e.watchedOn.startsWith(today().slice(0, 4)))), [entries]);

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
      <View style={styles.titleRow}>
        <BrandTitle theme={theme} size={38} />
        <View style={styles.headerIcons}>
          <Pressable
            onPress={() => router.push('/profile')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.75 }]}
          >
            <Avatar
              theme={theme}
              uri={settings.photo}
              name={settings.name}
              size={36}
              status={sync.status === 'signed-out' || sync.status === 'unconfigured' ? undefined : sync.status}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: pressed ? theme.chip : 'transparent' }]}
          >
            <Ionicons name="settings-outline" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>
      <Text style={[styles.tagline, { color: theme.textMuted }]}>{tagline(hour, settings.name)}</Text>

      {entries.length > 0 && (
        <View style={[styles.marquee, { borderColor: theme.accent + '55', backgroundColor: theme.accentSoft }]}>
          <MarqueeStat theme={theme} value={String(yearStats.total)} label={`IN ${today().slice(0, 4)}`} />
          <View style={[styles.marqueeRule, { backgroundColor: theme.accent + '44' }]} />
          <MarqueeStat theme={theme} value={`${hours}h`} label="WATCHED" />
          <View style={[styles.marqueeRule, { backgroundColor: theme.accent + '44' }]} />
          <MarqueeStat theme={theme} value={yearStats.avgStars ? `${yearStats.avgStars}★` : '—'} label="AVG" />
          <View style={[styles.marqueeRule, { backgroundColor: theme.accent + '44' }]} />
          <MarqueeStat theme={theme} value={String(yearStats.liked)} label="LOVED" />
        </View>
      )}

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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flex: 1 }}>
            {FILTERS.map((f) => (
              <Chip key={f.key} theme={theme} label={f.label} color={f.color} icon={f.icon} active={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </ScrollView>
          <Pressable
            onPress={() => update({ diaryLayout: grid ? 'list' : 'grid' })}
            hitSlop={6}
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
        Tap STORY on a month to turn it into an Instagram story. Long-press a ticket to edit, log again or delete it.
      </TipCard>
    </View>
  ) : undefined;

  const rows = sections.reduce((n, sec) => n + sec.data.length, 0);
  const first = sections[0]?.data[0]?.[0];
  const toTop = () => listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, viewOffset: 80, animated: true });
  // At the end of a long diary (the oldest entry): a way back up to the newest.
  const footer =
    rows > 6 && first ? (
      <View style={styles.end}>
        <Text style={[styles.endText, { color: theme.textMuted }]}>{filter === 'all' && !query.trim() ? 'You’ve reached the beginning' : 'That’s all of them'}</Text>
        <Pressable
          onPress={toTop}
          accessibilityRole="button"
          accessibilityLabel={`Back to the top, to ${first.title}`}
          style={({ pressed }) => [styles.endBtn, { borderColor: theme.border, backgroundColor: pressed ? theme.chip : 'transparent' }]}
        >
          <Ionicons name="arrow-up" size={18} color={theme.accent} />
          <Text style={[styles.endBtnText, { color: theme.text }]}>BACK TO THE TOP</Text>
        </Pressable>
      </View>
    ) : undefined;

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      {header}
      <SectionList
        ref={listRef}
        style={styles.scroller}
        sections={sections}
        keyExtractor={(row) => row.map((e) => e.id).join('|')}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // A screenful first, then the rest in small batches, so a long diary opens at once.
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={9}
        ListHeaderComponent={tip}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
        renderSectionHeader={({ section }) => (
          <ReelHeader
            month={section.month}
            count={section.count}
            theme={theme}
            onShare={() => router.navigate({ pathname: '/recap', params: { period: section.month } })}
          />
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
        ListEmptyComponent={
          !ready ? undefined : entries.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.accentSoft }]}>
                <MaterialCommunityIcons name="projector" size={40} color={theme.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>THE SCREEN IS DARK</Text>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>Log the last film, series or anime you watched, and your diary starts rolling.</Text>
              <Pressable
                onPress={() => router.navigate('/search')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.emptyBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
              >
                <MaterialCommunityIcons name="movie-search-outline" size={18} color={theme.accentText} />
                <Text style={[styles.emptyBtnText, { color: theme.accentText }]}>FIND A TITLE</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>NO MATCHES</Text>
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
            { backgroundColor: theme.accent, bottom: 20, boxShadow: shadow.glow(theme.accent), transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
        >
          <MaterialCommunityIcons name="movie-open-plus-outline" size={28} color={theme.accentText} />
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
                { label: 'Log again', icon: 'repeat', onPress: () => router.push({ pathname: '/log', params: { again: menu.id } }) },
                { label: 'Share as story card', icon: 'sparkles-outline', onPress: () => router.push({ pathname: '/card/[id]', params: { id: menu.id } }) },
                { label: 'Add to a list', icon: 'albums-outline', onPress: () => setListing(menu) },
                { label: 'Move to Trash', icon: 'trash-outline', destructive: true, onPress: () => remove(menu) },
              ]
            : []
        }
      />
      <AddToList item={listing} theme={theme} onClose={() => setListing(null)} />
    </View>
  );
}

function MarqueeStat({ theme, value, label }: { theme: ReturnType<typeof useTheme>; value: string; label: string }) {
  return (
    <View style={styles.marqueeStat}>
      <Text style={[styles.marqueeValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.marqueeLabel, { color: theme.accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: 16 },
  // The header sits above the list, so it carries the list's side padding itself.
  top: { gap: 12, paddingBottom: 6, paddingHorizontal: 16 },
  scroller: { flex: 1 },
  tip: { paddingTop: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatarBtn: { padding: 4 },
  tagline: { fontFamily: fonts.mono, fontSize: font.footnote, marginTop: -8 },
  marquee: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 10 },
  marqueeStat: { flex: 1, alignItems: 'center' },
  marqueeValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, includeFontPadding: false },
  marqueeLabel: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1.2 },
  marqueeRule: { width: 1, alignSelf: 'stretch' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: font.body, height: '100%' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { gap: 8, paddingRight: 8 },
  layoutBtn: { width: 36, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  gridRow: { flexDirection: 'row', gap: GAP },
  empty: { alignItems: 'center', gap: 10, paddingTop: 64, paddingHorizontal: 28 },
  end: { alignItems: 'center', gap: 12, paddingTop: 36, paddingBottom: 8 },
  endText: { fontFamily: fonts.mono, fontSize: font.footnote },
  endBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 20, borderRadius: 22, borderWidth: 1 },
  endBtnText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.5 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 32, letterSpacing: 1.5 },
  emptyText: { fontFamily: fonts.mono, fontSize: font.body, textAlign: 'center', lineHeight: 21 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 20, borderRadius: 23, marginTop: 10 },
  emptyBtnText: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1 },
  fab: { position: 'absolute', right: 20, width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
});
