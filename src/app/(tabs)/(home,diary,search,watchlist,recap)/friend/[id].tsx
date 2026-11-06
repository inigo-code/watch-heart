import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { ActionSheet } from '@/components/ActionSheet';
import { DangerButton } from '@/components/DangerButton';
import { Poster, Stars } from '@/components/Film';
import { ListCover } from '@/components/lists/ListCover';
import { Rise, Tap } from '@/components/Motion';
import { usePullRefresh } from '@/components/PullRefresh';
import { RichText } from '@/components/RichText';
import { SectionLabel } from '@/components/SectionLabel';
import { Segments } from '@/components/Segments';
import { Face, TitleRow, openTitle } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { blockPerson, friendDiary, friendListCache, friendLists, removeFriend } from '@/friends/friendsApi';
import type { FriendEntry } from '@/friends/friendsApi';
import { useFriends } from '@/friends/FriendsProvider';
import { friendlyDate } from '@/lib/dates';
import { easeNextLayout } from '@/lib/motion';
import { viewingRating, watchedLabel } from '@/lib/watched';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { UserList } from '@/lists/ListsProvider';
import type { Title } from '@/store/types';

const PAGE = 24;
const COLS = 4;
const GAP = 8;

const asTitle = (e: { kind: Title['kind']; source: string; sourceId: string; title: string; year: number | null; posterUrl: string | null }) =>
  ({
    kind: e.kind,
    source: e.source,
    sourceId: e.sourceId,
    title: e.title,
    year: e.year,
    posterUrl: e.posterUrl,
    backdropUrl: null,
    genres: [],
    runtime: null,
  }) as Title;

type Tab = 'diary' | 'reviews' | 'lists';

/** Their diary a month at a time, as posters. */
function byMonth(diary: FriendEntry[]) {
  const months: { key: string; label: string; items: FriendEntry[] }[] = [];
  for (const e of diary) {
    const key = e.undated ? 'archive' : e.watchedOn.slice(0, 7);
    let m = months.find((x) => x.key === key);
    if (!m) {
      const label = e.undated ? 'The Archive' : new Date(`${key}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      m = { key, label, items: [] };
      months.push(m);
    }
    m.items.push(e);
  }
  return months;
}

/** A friend: who they are, their favourites, then their diary, reviews and lists, a page at a time. */
export default function FriendScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { byId, photos, refresh, loading } = useFriends();
  const friend = byId(id);
  const [diary, setDiary] = useState<FriendEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lists, setLists] = useState<UserList[] | null>(null);
  const [tab, setTab] = useState<Tab>('diary');
  const [confirm, setConfirm] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const first = useCallback(
    () =>
      Promise.all([
        friendDiary(id, 0, PAGE)
          .then((rows) => {
            setDiary(rows);
            setMore(rows.length === PAGE);
            setFailed(null);
          })
          .catch((e) => setFailed(e instanceof Error ? e.message : 'Couldn’t load their diary')),
        friendLists(id)
          .catch(() => [] as UserList[])
          .then((l) => {
            friendListCache.set(id, l);
            setLists(l);
          }),
      ]),
    [id],
  );
  useEffect(() => {
    first().catch(() => {});
  }, [first]);
  const pull = usePullRefresh(theme, first);

  const loadMore = async () => {
    if (!diary || loadingMore) return;
    setLoadingMore(true);
    try {
      const rows = await friendDiary(id, diary.length, PAGE);
      setDiary([...diary, ...rows]);
      setMore(rows.length === PAGE);
    } catch {
      toast('Couldn’t load more. Try again.');
    }
    setLoadingMore(false);
  };

  const months = useMemo(() => byMonth(diary ?? []), [diary]);
  const reviews = useMemo(() => (diary ?? []).filter((e) => e.review), [diary]);
  const tile = (width - 32 - GAP * (COLS - 1)) / COLS;

  if (!friend) {
    return (
      <View style={styles.center}>
        {loading ? <ActivityIndicator color={theme.accent} /> : <Text style={[styles.empty, { color: theme.textMuted }]}>You’re not friends with this account any more</Text>}
      </View>
    );
  }

  const unfriend = async () => {
    try {
      await removeFriend(friend.id);
      toast(`Unfriended ${friend.name}`);
      router.back();
      await refresh(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t unfriend');
    }
  };

  const block = async () => {
    try {
      await blockPerson(friend.id);
      toast(`Blocked ${friend.name}`);
      router.back();
      await refresh(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t block');
    }
  };

  const since = new Date(friend.since).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const header = (
    <View style={styles.header}>
      <View style={styles.who}>
        <Face uri={photos[friend.id] ?? null} name={friend.name} theme={theme} size={96} round />
        <Text style={[styles.name, { color: theme.text }]}>{friend.name.toUpperCase()}</Text>
        {!!friend.bio && <Text style={[styles.bio, { color: theme.textMuted }]}>{friend.bio}</Text>}
      </View>
      <View style={styles.stats}>
        <Stat theme={theme} value={String(friend.entries)} label="Logged" />
        <Stat theme={theme} value={lists ? String(lists.length) : '–'} label="Lists" />
        <Stat theme={theme} value={since} label="Friends since" small />
      </View>
      {friend.favourites.length > 0 && (
        <View style={styles.favourites}>
          <SectionLabel theme={theme}>Favourites</SectionLabel>
          <TitleRow titles={friend.favourites.map(asTitle)} theme={theme} width={84} />
        </View>
      )}
      <Segments
        theme={theme}
        value={tab}
        onChange={setTab}
        options={[
          { key: 'diary', label: 'DIARY' },
          { key: 'reviews', label: 'REVIEWS' },
          { key: 'lists', label: 'LISTS' },
        ]}
      />
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {tab !== 'lists' && more && (
        <Tap onPress={loadMore} disabled={loadingMore} accessibilityRole="button" style={[styles.more, { borderColor: theme.accent }]}>
          {loadingMore ? <ActivityIndicator color={theme.accent} /> : <Text style={[styles.moreText, { color: theme.text }]}>LOAD MORE</Text>}
        </Tap>
      )}
      <DangerButton theme={theme} icon="person-remove-outline" label={`Unfriend ${friend.name}`} onPress={() => setConfirm(true)} />
    </View>
  );

  const nothing = (text: string) => <Text style={[styles.empty, { color: theme.textMuted }]}>{text}</Text>;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: '' }} />
      <FlatList<unknown>
        data={tab === 'diary' ? months : tab === 'reviews' ? reviews : lists?.length ? [{ key: 'lists' }] : []}
        refreshControl={pull}
        keyExtractor={(x) => (x as { key?: string; id?: string }).key ?? (x as { id: string }).id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          failed ? (
            nothing(failed)
          ) : diary === null ? (
            <ActivityIndicator color={theme.accent} />
          ) : tab === 'diary' ? (
            nothing('Nothing to show yet')
          ) : tab === 'reviews' ? (
            nothing(more ? 'None so far. Load more to look further back.' : 'No reviews yet')
          ) : (
            nothing('No lists shared')
          )
        }
        renderItem={({ item, index }) =>
          tab === 'diary' ? (
            <Month month={item as (typeof months)[number]} tile={tile} theme={theme} order={index} />
          ) : tab === 'reviews' ? (
            <Review e={item as FriendEntry} theme={theme} />
          ) : (
            <View style={styles.listRow}>
              {(lists ?? []).map((l) => (
                <Tap key={l.id} onPress={() => router.push({ pathname: '/friend-list', params: { friend: friend.id, list: l.id } })} accessibilityRole="button" style={styles.listCard}>
                  <ListCover items={l.items} theme={theme} width={150} />
                  <Text style={[styles.listName, { color: theme.text }]} numberOfLines={2}>
                    {l.name}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textMuted }]}>{l.items.length} titles</Text>
                </Tap>
              ))}
            </View>
          )
        }
      />
      <ActionSheet
        visible={confirm}
        title={`Unfriend ${friend.name}? They won’t be able to come back with your old code. To stop them finding or asking you too, block them.`}
        actions={[
          { label: `Unfriend ${friend.name}`, icon: 'person-remove-outline', destructive: true, onPress: unfriend },
          { label: `Block ${friend.name}`, icon: 'ban-outline', destructive: true, onPress: block },
        ]}
        onClose={() => setConfirm(false)}
      />
    </View>
  );
}

function Stat({ theme, value, label, small }: { theme: Theme; value: string; label: string; small?: boolean }) {
  return (
    <View style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.statValue, small && styles.statSmall, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** A month of their diary: a wall of posters, each with the rating under it. */
function Month({ month, tile, theme, order }: { month: { label: string; items: FriendEntry[] }; tile: number; theme: Theme; order: number }) {
  return (
    <Rise order={order} style={styles.month}>
      <SectionLabel theme={theme}>{month.label}</SectionLabel>
      <View style={styles.wall}>
        {month.items.map((e) => (
          <Tap key={e.id} onPress={() => openTitle(asTitle(e))} accessibilityRole="button" accessibilityLabel={`${e.title}${e.rating ? `, ${e.rating / 2} stars` : ''}`} style={{ width: tile }}>
            <Poster uri={e.posterUrl} title={e.title} width={tile} theme={theme} radius={6} />
            <View style={styles.marks}>
              {viewingRating(e) ? <Stars rating={viewingRating(e)} size={12} color={theme.star} /> : null}
              {e.liked && <Ionicons name="heart" size={12} color={theme.like} />}
            </View>
            {!!watchedLabel(e) && (
              <Text style={[styles.what, { color: theme.accent }]} numberOfLines={1}>
                {watchedLabel(e)}
              </Text>
            )}
          </Tap>
        ))}
      </View>
    </Rise>
  );
}

/** One of their reviews: the title, the rating, and the words (spoilers behind a tap). */
function Review({ e, theme }: { e: FriendEntry; theme: Theme }) {
  const [reveal, setReveal] = useState(false);
  const hidden = e.spoilers && !reveal;
  return (
    <View style={[styles.review, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Pressable onPress={() => openTitle(asTitle(e))} accessibilityRole="button" accessibilityLabel={`${e.title}, open its page`} style={styles.reviewHead}>
        <Poster uri={e.posterUrl} title={e.title} width={52} theme={theme} radius={4} />
        <View style={styles.reviewTitle}>
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={2}>
            {e.title}
          </Text>
          {!!watchedLabel(e) && <Text style={[styles.what, { color: theme.accent }]}>{watchedLabel(e)}</Text>}
          <View style={styles.marks}>
            {viewingRating(e) ? <Stars rating={viewingRating(e)} size={14} color={theme.star} /> : null}
            {e.liked && <Ionicons name="heart" size={14} color={theme.like} />}
          </View>
          <Text style={[styles.meta, { color: theme.textMuted }]}>{e.undated ? 'Date unknown' : friendlyDate(e.watchedOn)}</Text>
        </View>
      </Pressable>
      {hidden ? (
        <Pressable
          onPress={() => {
            easeNextLayout();
            setReveal(true);
          }}
          accessibilityRole="button"
          style={styles.spoiler}
        >
          <Ionicons name="eye-off-outline" size={16} color={theme.textMuted} />
          <Text style={[styles.meta, { color: theme.textMuted }]}>Spoilers</Text>
        </Pressable>
      ) : (
        <RichText text={e.review} theme={theme} style={{ ...styles.reviewText, color: theme.text }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { padding: 16, gap: 20 },
  header: { gap: 20 },
  who: { alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, letterSpacing: 1, textAlign: 'center' },
  bio: { fontSize: font.body, lineHeight: 22, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 4 },
  statValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  statSmall: { fontSize: 22 },
  statLabel: { fontSize: font.caption, fontWeight: '600' },
  favourites: { gap: 10 },
  month: { gap: 10 },
  wall: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  marks: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 18, marginTop: 2 },
  what: { fontFamily: fonts.monoBold, fontSize: font.caption },
  empty: { fontSize: font.body, textAlign: 'center', paddingVertical: 24 },
  footer: { gap: 16, marginTop: 8 },
  more: { height: 48, borderWidth: 1.5, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
  review: { gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewTitle: { flex: 1, gap: 2 },
  rowTitle: { fontSize: font.body, fontWeight: '700' },
  meta: { fontSize: font.footnote },
  spoiler: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewText: { fontSize: font.body, lineHeight: 22 },
  listRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  listCard: { width: 150, gap: 4 },
  listName: { fontSize: font.footnote, fontWeight: '700' },
});
