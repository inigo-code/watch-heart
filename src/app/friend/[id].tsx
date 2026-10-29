import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ActionSheet';
import { DangerButton } from '@/components/DangerButton';
import { Poster, Stars } from '@/components/Film';
import { ListCover } from '@/components/lists/ListCover';
import { RichText } from '@/components/RichText';
import { SectionLabel } from '@/components/SectionLabel';
import { Face, TitleRow, openTitle } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { friendDiary, friendListCache, friendLists, removeFriend } from '@/friends/friendsApi';
import type { FriendEntry } from '@/friends/friendsApi';
import { useFriends } from '@/friends/FriendsProvider';
import { friendlyDate } from '@/lib/dates';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { UserList } from '@/lists/ListsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Title } from '@/store/types';

const asTitle = (e: { kind: Title['kind']; source: string; sourceId: string; title: string; year: number | null; posterUrl: string | null }) =>
  ({ kind: e.kind, source: e.source, sourceId: e.sourceId, title: e.title, year: e.year, posterUrl: e.posterUrl, backdropUrl: null, genres: [], runtime: null }) as Title;

/** A friend: who they are, their favourites, their diary (with reviews, spoilers hidden) and their lists. */
export default function FriendScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { byId, photos, refresh } = useFriends();
  const { entries } = useDiary();
  const friend = byId(id);
  const [diary, setDiary] = useState<FriendEntry[] | null>(null);
  const [lists, setLists] = useState<UserList[] | null>(null);
  const [tab, setTab] = useState<'diary' | 'lists'>('diary');
  const [confirm, setConfirm] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    friendDiary(id)
      .then(setDiary)
      .catch((e) => setFailed(e instanceof Error ? e.message : 'Couldn’t load their diary'));
    friendLists(id)
      .then((l) => {
        friendListCache.set(id, l);
        setLists(l);
      })
      .catch(() => setLists([]));
  }, [id]);

  // Titles you've both logged.
  const both = useMemo(() => {
    if (!diary) return 0;
    const mine = new Set(entries.filter((e) => !e.deletedAt && e.source !== 'manual').map((e) => `${e.source}:${e.sourceId}`));
    return new Set(diary.filter((e) => mine.has(`${e.source}:${e.sourceId}`)).map((e) => `${e.source}:${e.sourceId}`)).size;
  }, [diary, entries]);

  if (!friend) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.hint, { color: theme.textMuted }]}>You’re not friends with this account any more.</Text>
      </View>
    );
  }

  const unfriend = async () => {
    try {
      await removeFriend(friend.id);
      await refresh();
      toast(`Unfriended ${friend.name}`);
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t unfriend');
    }
  };

  const since = new Date(friend.since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const header = (
    <View style={styles.header}>
      <View style={styles.top}>
        <Face uri={photos[friend.id] ?? null} name={friend.name} theme={theme} size={96} round />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.name, { color: theme.text }]}>{friend.name.toUpperCase()}</Text>
          {!!friend.bio && <Text style={[styles.bio, { color: theme.text }]}>{friend.bio}</Text>}
          <Text style={[styles.hint, { color: theme.textMuted }]}>Friends since {since}</Text>
        </View>
      </View>
      <View style={[styles.stats, { borderColor: theme.border }]}>
        <Stat theme={theme} value={friend.entries} label="IN THEIR DIARY" />
        <Stat theme={theme} value={both} label="YOU’VE BOTH SEEN" />
        <Stat theme={theme} value={lists?.length ?? 0} label="LISTS" />
      </View>
      {friend.favourites.length > 0 && (
        <View style={{ gap: 10 }}>
          <SectionLabel theme={theme}>Favourites</SectionLabel>
          <TitleRow titles={friend.favourites.map(asTitle)} theme={theme} width={84} />
        </View>
      )}
      <View style={styles.tabs}>
        {(['diary', 'lists'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            style={[styles.tab, tab === t && { borderBottomColor: theme.accent }]}
          >
            <Text style={[styles.tabText, { color: tab === t ? theme.accent : theme.textMuted }]}>{t.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const footer = (
    <View style={{ marginTop: 28 }}>
      <DangerButton theme={theme} label={`Unfriend ${friend.name}`} onPress={() => setConfirm(true)} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: '' }} />
      {tab === 'diary' ? (
        <FlatList
          data={diary ?? []}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            diary === null && !failed ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <Text style={[styles.hint, { color: failed ? theme.danger : theme.textMuted }]}>
                {failed ?? `${friend.name} keeps their diary private, or hasn’t logged anything yet.`}
              </Text>
            )
          }
          ListFooterComponent={footer}
          initialNumToRender={12}
          renderItem={({ item }) => <DiaryRow e={item} theme={theme} />}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
          {header}
          {lists === null ? (
            <ActivityIndicator color={theme.accent} />
          ) : lists.length === 0 ? (
            <Text style={[styles.hint, { color: theme.textMuted }]}>No lists shared.</Text>
          ) : (
            <View style={styles.grid}>
              {lists.map((l) => (
                <Pressable
                  key={l.id}
                  onPress={() => router.push({ pathname: '/friend-list', params: { friend: friend.id, list: l.id } })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.listCard, pressed && { opacity: 0.8 }]}
                >
                  <ListCover items={l.items} theme={theme} width={150} />
                  <Text style={[styles.listName, { color: theme.text }]} numberOfLines={2}>
                    {l.name}
                  </Text>
                  <Text style={[styles.hint, { color: theme.textMuted }]}>
                    {l.items.length} {l.items.length === 1 ? 'title' : 'titles'}
                    {l.ranked ? ' · ranked' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          {footer}
        </ScrollView>
      )}
      <ActionSheet
        visible={confirm}
        title={`Unfriend ${friend.name}? You’ll stop seeing each other’s diaries and lists. You can be friends again with an invite code.`}
        actions={[{ label: `Unfriend ${friend.name}`, icon: 'person-remove-outline', destructive: true, onPress: unfriend }]}
        onClose={() => setConfirm(false)}
      />
    </View>
  );
}

function Stat({ theme, value, label }: { theme: Theme; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.accent }]}>{label}</Text>
    </View>
  );
}

/** One of their viewings: poster, rating, date, and their review (spoilers behind a tap). */
function DiaryRow({ e, theme }: { e: FriendEntry; theme: Theme }) {
  const [reveal, setReveal] = useState(false);
  const hidden = e.spoilers && !reveal;
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <Pressable onPress={() => openTitle(asTitle(e))} accessibilityRole="button" accessibilityLabel={`${e.title}, open its page`}>
        <Poster uri={e.posterUrl} title={e.title} width={56} theme={theme} radius={4} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Pressable onPress={() => openTitle(asTitle(e))} accessibilityRole="button">
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={2}>
            {e.title}
            {e.year ? <Text style={[styles.hint, { color: theme.textMuted }]}>{`  ${e.year}`}</Text> : null}
          </Text>
        </Pressable>
        <View style={styles.rowMeta}>
          {e.rating ? <Stars rating={e.rating} size={13} color={theme.star} /> : null}
          {e.liked && <Ionicons name="heart" size={13} color={theme.like} />}
          {e.rewatch && <Ionicons name="repeat" size={13} color={theme.textMuted} accessibilityLabel="Rewatch" />}
          <Text style={[styles.hint, { color: theme.textMuted }]}>{e.undated ? 'Date unknown' : friendlyDate(e.watchedOn)}</Text>
        </View>
        {!!e.vibes?.length && <Text style={[styles.vibes, { color: theme.accent }]}>{e.vibes.join(' · ').toUpperCase()}</Text>}
        {!!e.review &&
          (hidden ? (
            <Pressable onPress={() => setReveal(true)} accessibilityRole="button" style={styles.spoiler}>
              <Ionicons name="eye-off-outline" size={14} color={theme.textMuted} />
              <Text style={[styles.hint, { color: theme.textMuted }]}>Contains spoilers. Tap to read.</Text>
            </Pressable>
          ) : (
            <RichText text={e.review} theme={theme} style={{ ...styles.review, color: theme.text }} />
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { gap: 18, marginBottom: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, letterSpacing: 1 },
  bio: { fontSize: font.body, lineHeight: 21 },
  hint: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17 },
  stats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32 },
  statLabel: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 1.2, textAlign: 'center' },
  tabs: { flexDirection: 'row', gap: 22 },
  tab: { paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.5 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTitle: { fontSize: font.body, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vibes: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1 },
  review: { fontSize: font.footnote, lineHeight: 20 },
  spoiler: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  listCard: { width: 150, gap: 4 },
  listName: { fontSize: font.footnote, fontWeight: '700' },
});
