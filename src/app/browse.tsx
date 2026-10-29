import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Dimensions, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tmdbKey } from '@/api';
import { watchRegion } from '@/api/omdb';
import { BROWSE_GENRES, discoverTmdb, genreId, regionProviders } from '@/api/tmdb';
import type { BrowseQuery, BrowseSort, Provider } from '@/api/tmdb';
import { BottomSheet } from '@/components/BottomSheet';
import { Chip, Poster } from '@/components/Film';
import { SectionLabel } from '@/components/SectionLabel';
import { openTitle, warmTitle } from '@/components/title/Rows';
import { DECADES, LANGUAGES, kindsFor } from '@/lib/discover';
import { KIND_COLORS, font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { MediaKind, Title } from '@/store/types';

const KINDS: { kind: MediaKind; label: string }[] = [
  { kind: 'movie', label: 'FILMS' },
  { kind: 'tv', label: 'SERIES' },
  { kind: 'anime', label: 'ANIME' },
];

const SORTS: { key: BrowseSort; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'rating', label: 'Top rated' },
  { key: 'newest', label: 'Newest' },
];

/** A grid of titles from a Discover query (a shelf, a genre, a service…), sortable and filterable, loading more as you scroll. */
export default function BrowseScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ q: string; name?: string; filters?: string }>();
  const { settings } = useSettings();
  const key = tmdbKey(settings.tmdbKey);
  const region = watchRegion(settings.watchRegion);
  const { viewingsOf } = useDiary();
  // The shelf as it opened: what makes it this shelf (India, a release window…), which Clear goes back to.
  const [base] = useState<BrowseQuery>(() => JSON.parse(params.q) as BrowseQuery);
  const [query, setQuery] = useState<BrowseQuery>(base);
  const [name, setName] = useState(params.name ?? 'Discover');
  const [filtering, setFiltering] = useState(params.filters === '1');
  // Results belong to the query they were fetched for; a new query starts again from the first page.
  const qKey = JSON.stringify(query);
  const [data, setData] = useState<{ q: string; items: Title[]; page: number; pages: number; error: string | null } | null>(null);
  const current = data?.q === qKey ? data : null;
  const items = current?.items ?? [];
  const error = current?.error ?? null;
  const [loadingMore, setLoadingMore] = useState(false);
  const loading = !current || loadingMore;
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    discoverTmdb(key, query, 1, controller.signal)
      .then((r) => setData({ q: qKey, items: r.results.filter((t) => t.posterUrl), page: 1, pages: r.pages, error: null }))
      .catch((e) => {
        if (controller.signal.aborted) return;
        const message = e instanceof Error && e.message !== 'Network request failed' ? e.message : 'No connection. Check your internet and try again.';
        setData({ q: qKey, items: [], page: 1, pages: 1, error: message });
      });
    return () => controller.abort();
  }, [key, query, qKey]);

  const more = () => {
    if (!current || loadingRef.current || current.page >= current.pages || current.error) return;
    loadingRef.current = true;
    setLoadingMore(true);
    discoverTmdb(key, query, current.page + 1)
      .then((r) =>
        setData((d) =>
          d && d.q === qKey
            ? // Popularity shifts between pages, so a title can turn up twice.
              { ...d, page: d.page + 1, items: [...d.items, ...r.results.filter((t) => t.posterUrl && !d.items.some((p) => p.sourceId === t.sourceId))] }
            : d,
        ),
      )
      .catch(() => {})
      .finally(() => {
        loadingRef.current = false;
        setLoadingMore(false);
      });
  };

  const columns = 3;
  const cell = Math.floor((width - 32 - (columns - 1) * 10) / columns);
  const sort = query.sort ?? 'popular';
  const kinds = kindsFor(query);
  // A genre TMDB doesn't file this kind under (Horror series): say so, rather than "nothing matches".
  const noGenre = query.genres?.find((g) => genreId(g, query.kind) === undefined);
  const kindName = query.kind === 'movie' ? 'films' : query.kind === 'tv' ? 'series' : 'anime';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: name.toUpperCase() }} />
      <FlatList
        data={items}
        numColumns={columns}
        keyExtractor={(t) => t.sourceId}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}
        onEndReached={more}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            {kinds.length > 1 && (
              <View style={[styles.kinds, { borderColor: theme.border }]}>
                {KINDS.filter((k) => kinds.includes(k.kind)).map((k) => {
                  const on = query.kind === k.kind;
                  return (
                    <Pressable
                      key={k.kind}
                      onPress={() => setQuery((q) => ({ ...q, kind: k.kind }))}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      style={[styles.kind, on && { backgroundColor: KIND_COLORS[k.kind] }]}
                    >
                      <Text style={[styles.kindText, { color: on ? '#0B0A0D' : theme.textMuted }]}>{k.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={styles.bar}>
              {SORTS.map((s) => (
                <Chip key={s.key} theme={theme} label={s.label} active={sort === s.key} onPress={() => setQuery((q) => ({ ...q, sort: s.key }))} />
              ))}
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => setFiltering(true)}
                accessibilityRole="button"
                accessibilityLabel="Filters"
                hitSlop={8}
                style={[styles.filterBtn, { borderColor: theme.border }]}
              >
                <Ionicons name="options-outline" size={18} color={theme.text} />
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? undefined : (
            <Text style={[styles.note, { color: error ? theme.danger : theme.textMuted }]}>
              {error ?? (noGenre ? `TMDB doesn’t file ${kindName} under ${noGenre}. Try another kind.` : 'Nothing matches. Try fewer filters.')}
            </Text>
          )
        }
        ListFooterComponent={loading ? <ActivityIndicator color={theme.accent} style={{ marginTop: 16 }} /> : undefined}
        renderItem={({ item }) => {
          const seen = viewingsOf(item.source, item.sourceId).length > 0;
          return (
            <Pressable
              onPressIn={() => warmTitle(item)}
              onPress={() => openTitle(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}${item.year ? `, ${item.year}` : ''}${seen ? ', in your diary' : ''}`}
              style={({ pressed }) => [{ width: cell }, pressed && { opacity: 0.8 }]}
            >
              <View>
                <Poster uri={item.posterUrl} title={item.title} width={cell} theme={theme} radius={6} style={seen && styles.watched} />
                {seen && (
                  <View style={[styles.tick, { backgroundColor: theme.accent }]}>
                    <Ionicons name="checkmark" size={13} color={theme.accentText} />
                  </View>
                )}
              </View>
              <Text style={[styles.cellTitle, { color: theme.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              {!!item.year && <Text style={[styles.cellYear, { color: theme.textMuted }]}>{item.year}</Text>}
            </Pressable>
          );
        }}
      />
      <Filters
        visible={filtering}
        theme={theme}
        query={query}
        base={base}
        tmdb={key}
        region={region}
        onClose={() => setFiltering(false)}
        onApply={(q) => {
          setFiltering(false);
          setQuery(q);
          if (name === 'Discover' || params.filters === '1') setName('Your filters');
        }}
      />
    </View>
  );
}

/** The filter builder: kind, genres, decade, language, score, length and streaming service, on top of the shelf. */
function Filters({
  visible,
  theme,
  query,
  base,
  tmdb,
  region,
  onClose,
  onApply,
}: {
  visible: boolean;
  theme: Theme;
  query: BrowseQuery;
  base: BrowseQuery;
  tmdb: string;
  region: string;
  onClose: () => void;
  onApply: (q: BrowseQuery) => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(query);
  const [providers, setProviders] = useState<Provider[]>([]);
  // Opening the sheet starts from what's showing.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(query);
  }

  useEffect(() => {
    if (!visible || providers.length) return;
    const controller = new AbortController();
    regionProviders(tmdb, region, controller.signal)
      .then((list) => setProviders(list.slice(0, 16)))
      .catch(() => {});
    return () => controller.abort();
  }, [visible, providers.length, tmdb, region]);

  const set = (patch: Partial<BrowseQuery>) => setDraft((d) => ({ ...d, ...patch }));
  const genres = BROWSE_GENRES.filter((g) => genreId(g.name, draft.kind) !== undefined && !(draft.kind === 'anime' && g.name === 'Animation'));
  const decade = draft.from && draft.to && draft.to - draft.from === 9 ? draft.from : null;
  // Only the kinds this shelf can have (no anime among Indian films), and no decades on a shelf that is
  // already a time (new releases, classics, this year's best).
  const kinds = kindsFor(base);
  const timed = !!(base.days || base.from || base.to);
  const toggleGenre = (name: string) => {
    const g = draft.genres ?? [];
    set({ genres: g.includes(name) ? g.filter((x) => x !== name) : [...g, name] });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.bg, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: theme.text }]}>FILTERS</Text>
          <Pressable
            onPress={() => setDraft({ ...base, kind: draft.kind, sort: draft.sort, genres: base.genres?.filter((g) => genreId(g, draft.kind) !== undefined) })}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={[styles.clear, { color: theme.textMuted }]}>CLEAR</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          <Group theme={theme} title="Kind">
            {kinds.map((k) => (
              <Chip
                key={k}
                theme={theme}
                label={k === 'movie' ? 'Films' : k === 'tv' ? 'Series' : 'Anime'}
                active={draft.kind === k}
                onPress={() =>
                  set({
                    kind: k,
                    genres: draft.genres?.filter((g) => genreId(g, k) !== undefined),
                    status: k === 'movie' ? undefined : draft.status,
                    tvType: k === 'movie' ? undefined : draft.tvType,
                    maxRuntime: k === 'movie' ? draft.maxRuntime : undefined,
                  })
                }
              />
            ))}
          </Group>
          <Group theme={theme} title="Genres (all of)">
            {genres.map((g) => (
              <Chip key={g.name} theme={theme} label={g.name} active={draft.genres?.includes(g.name)} onPress={() => toggleGenre(g.name)} />
            ))}
          </Group>
          {!timed && (
            <Group theme={theme} title="Decade">
              {DECADES.map((d) => (
                <Chip
                  key={d}
                  theme={theme}
                  label={`${d}s`}
                  active={decade === d}
                  onPress={() => set(decade === d ? { from: undefined, to: undefined } : { from: d, to: d + 9 })}
                />
              ))}
            </Group>
          )}
          {draft.kind !== 'anime' && (
            <Group theme={theme} title="Original language">
              {LANGUAGES.map((l) => (
                <Chip
                  key={l.code}
                  theme={theme}
                  label={l.name}
                  active={draft.lang === l.code}
                  onPress={() => set({ lang: draft.lang === l.code ? undefined : l.code })}
                />
              ))}
            </Group>
          )}
          <Group theme={theme} title="TMDB score at least">
            {[6, 7, 7.5, 8].map((s) => (
              <Chip
                key={s}
                theme={theme}
                label={`${s}+`}
                active={draft.minScore === s}
                onPress={() => set({ minScore: draft.minScore === s ? undefined : s })}
              />
            ))}
          </Group>
          {draft.kind === 'movie' && (
            <Group theme={theme} title="Length">
              {[90, 120, 150].map((m) => (
                <Chip
                  key={m}
                  theme={theme}
                  label={`Under ${m} min`}
                  active={draft.maxRuntime === m}
                  onPress={() => set({ maxRuntime: draft.maxRuntime === m ? undefined : m })}
                />
              ))}
            </Group>
          )}
          {draft.kind !== 'movie' && (
            <Group theme={theme} title="Status">
              <Chip theme={theme} label="Ended" active={draft.status === 3} onPress={() => set({ status: draft.status === 3 ? undefined : 3 })} />
              <Chip theme={theme} label="Still running" active={draft.status === 0} onPress={() => set({ status: draft.status === 0 ? undefined : 0 })} />
              <Chip theme={theme} label="Miniseries" active={draft.tvType === 2} onPress={() => set({ tvType: draft.tvType === 2 ? undefined : 2 })} />
            </Group>
          )}
          {providers.length > 0 && (
            <Group theme={theme} title={`Streaming on · ${region}`}>
              {providers.map((p) => (
                <Chip
                  key={p.id}
                  theme={theme}
                  label={p.name}
                  active={draft.provider === p.id}
                  onPress={() => set(draft.provider === p.id ? { provider: undefined, region: undefined } : { provider: p.id, region })}
                />
              ))}
            </Group>
          )}
        </ScrollView>
        <Pressable
          onPress={() => onApply(draft)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.apply, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.applyText, { color: theme.accentText }]}>SHOW RESULTS</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

function Group({ theme, title, children }: { theme: Theme; title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <SectionLabel theme={theme}>{title}</SectionLabel>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  kinds: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 3, gap: 3 },
  kind: { flex: 1, height: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  kindText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.5 },
  filterBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  note: { fontFamily: fonts.mono, fontSize: font.footnote, textAlign: 'center', paddingVertical: 32 },
  watched: { opacity: 0.25 },
  tick: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cellTitle: { fontSize: font.footnote, fontWeight: '700', marginTop: 6, lineHeight: 17 },
  cellYear: { fontFamily: fonts.mono, fontSize: font.caption },
  sheet: { maxHeight: Dimensions.get('window').height * 0.85, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 28, letterSpacing: 1 },
  clear: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
  sheetBody: { paddingHorizontal: 16, gap: 18, paddingBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  apply: { marginHorizontal: 16, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  applyText: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1.5 },
});
