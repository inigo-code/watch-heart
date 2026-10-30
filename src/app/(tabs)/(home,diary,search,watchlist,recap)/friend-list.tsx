import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Poster } from '@/components/Film';
import { openTitle } from '@/components/title/Rows';
import { friendListCache, friendLists } from '@/friends/friendsApi';
import { useFriends } from '@/friends/FriendsProvider';
import { font, fonts, useTheme } from '@/lib/theme';
import type { ListItem, UserList } from '@/lists/ListsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Title } from '@/store/types';

const asTitle = (i: ListItem) => ({ ...i, backdropUrl: null, genres: [], runtime: null }) as Title;

/** One of a friend's lists: numbered rows when ranked, otherwise a poster grid. Seen ones are ticked. */
export default function FriendListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ friend: string; list: string }>();
  const { byId } = useFriends();
  const { viewingsOf } = useDiary();
  const [lists, setLists] = useState<UserList[] | null>(() => friendListCache.get(params.friend) ?? null);

  useEffect(() => {
    if (lists) return;
    friendLists(params.friend)
      .then((l) => {
        friendListCache.set(params.friend, l);
        setLists(l);
      })
      .catch(() => setLists([]));
  }, [lists, params.friend]);

  const list = lists?.find((l) => l.id === params.list);
  if (!lists) return <ActivityIndicator color={theme.accent} style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (!list) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.hint, { color: theme.textMuted }]}>This list isn’t shared any more.</Text>
      </View>
    );
  }

  const owner = byId(params.friend)?.name ?? 'A friend';
  const columns = 3;
  const cell = Math.floor((width - 32 - (columns - 1) * 10) / columns);
  const seen = (i: ListItem) => viewingsOf(i.source, i.sourceId).length > 0;

  return (
    <FlatList
      key={list.ranked ? 'rows' : 'grid'}
      style={{ backgroundColor: theme.bg }}
      data={list.items}
      numColumns={list.ranked ? 1 : columns}
      keyExtractor={(i) => `${i.source}:${i.sourceId}:${i.title}`}
      columnWrapperStyle={list.ranked ? undefined : { gap: 10 }}
      contentContainerStyle={{ padding: 16, gap: list.ranked ? 0 : 14, paddingBottom: insets.bottom + 24 }}
      ListHeaderComponent={
        <View style={styles.header}>
          <Stack.Screen options={{ title: 'LIST' }} />
          <Text style={[styles.owner, { color: theme.accent }]}>{owner.toUpperCase()}’S LIST</Text>
          <Text style={[styles.name, { color: theme.text }]}>{list.name.toUpperCase()}</Text>
          {!!list.description && <Text style={[styles.desc, { color: theme.textMuted }]}>{list.description}</Text>}
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            {list.items.length} {list.items.length === 1 ? 'title' : 'titles'}
            {list.ranked ? ' · ranked' : ''} · you’ve seen {list.items.filter(seen).length}
          </Text>
        </View>
      }
      renderItem={({ item, index }) =>
        list.ranked ? (
          <Pressable
            onPress={() => openTitle(asTitle(item))}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, { borderBottomColor: theme.border, opacity: pressed ? 0.75 : 1 }]}
          >
            <Text style={[styles.rank, { color: index < 3 ? theme.accent : theme.textMuted }]}>{index + 1}</Text>
            <Poster uri={item.posterUrl} title={item.title} width={44} theme={theme} radius={4} />
            <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={2}>
              {item.title}
              {item.year ? <Text style={[styles.hint, { color: theme.textMuted }]}>{`  ${item.year}`}</Text> : null}
            </Text>
            {seen(item) && <Text style={[styles.seen, { color: theme.accent }]}>SEEN</Text>}
          </Pressable>
        ) : (
          <Pressable onPress={() => openTitle(asTitle(item))} accessibilityRole="button" style={({ pressed }) => [{ width: cell }, pressed && { opacity: 0.8 }]}>
            <Poster uri={item.posterUrl} title={item.title} width={cell} theme={theme} radius={6} />
            <Text style={[styles.cellTitle, { color: theme.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.hint, { color: seen(item) ? theme.accent : theme.textMuted }]}>{seen(item) ? 'SEEN' : (item.year ?? '')}</Text>
          </Pressable>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { gap: 6, marginBottom: 14 },
  owner: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 2 },
  name: { fontFamily: fonts.display, fontSize: 36, lineHeight: 38, letterSpacing: 1 },
  desc: { fontSize: font.body, lineHeight: 21 },
  hint: { fontFamily: fonts.mono, fontSize: font.caption },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  rank: { width: 30, fontFamily: fonts.display, fontSize: 26, textAlign: 'center' },
  rowTitle: { flex: 1, fontSize: font.body, fontWeight: '700' },
  seen: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1 },
  cellTitle: { fontSize: font.footnote, fontWeight: '700', marginTop: 6 },
});
