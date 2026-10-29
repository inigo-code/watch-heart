import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Stars } from '@/components/Film';
import { RichText } from '@/components/RichText';
import { Face, RowHead } from '@/components/title/Rows';
import { titleFriends, titleInFriendLists } from '@/friends/friendsApi';
import type { FriendEntry } from '@/friends/friendsApi';
import { useFriends } from '@/friends/FriendsProvider';
import { friendlyDate } from '@/lib/dates';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { UserList } from '@/lists/ListsProvider';

type Found = { key: string; entries: FriendEntry[]; lists: (UserList & { userId: string })[] };

/**
 * What your friends made of a title: who's seen it and how they rated it, their reviews (spoilers behind a
 * tap), and their lists it's on. Nothing shows until you have friends who've logged it.
 */
export function FriendsOnTitle({ source, sourceId, theme }: { source: string; sourceId: string; theme: Theme }) {
  const { available, friends, byId, photos } = useFriends();
  const [found, setFound] = useState<Found | null>(null);
  const key = `${source}:${sourceId}`;
  const ask = available && friends.length > 0 && source !== 'manual' && !!sourceId;

  useEffect(() => {
    if (!ask) return;
    let live = true;
    Promise.all([titleFriends(source, sourceId).catch(() => []), titleInFriendLists(source, sourceId).catch(() => [])]).then(
      ([entries, lists]) => live && setFound({ key, entries, lists }),
    );
    return () => {
      live = false;
    };
  }, [ask, key, source, sourceId]);

  const data = found?.key === key ? found : null;
  if (!ask || !data || (!data.entries.length && !data.lists.length)) return null;

  // Each friend once: their latest viewing, and how many times they've seen it.
  const people = new Map<string, { latest: FriendEntry; times: number }>();
  for (const e of data.entries) {
    const p = people.get(e.userId);
    if (!p) people.set(e.userId, { latest: e, times: 1 });
    else p.times++;
  }
  const rows = [...people.entries()];
  const rated = rows.map(([, p]) => p.latest.rating).filter(Boolean);
  const avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length / 2 : null;
  const reviews = data.entries.filter((e) => e.review.trim());
  const name = (id: string) => byId(id)?.name ?? 'A friend';

  return (
    <View style={styles.wrap}>
      {rows.length > 0 && (
        <View style={styles.block}>
          <RowHead title={`Friends who’ve seen it (${rows.length})`} theme={theme} />
          {avg !== null && (
            <Text style={[styles.avg, { color: theme.textMuted }]}>
              <Text style={{ color: theme.text, fontFamily: fonts.display, fontSize: 26 }}>{avg.toFixed(1)}</Text>
              <Text style={{ color: theme.star }}>★</Text> from {rated.length} {rated.length === 1 ? 'friend' : 'friends'}
            </Text>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.people}>
            {rows.map(([id, p]) => (
              <Pressable
                key={id}
                onPress={() => router.push({ pathname: '/friend/[id]', params: { id } })}
                accessibilityRole="button"
                accessibilityLabel={`${name(id)}${p.latest.rating ? `, ${p.latest.rating / 2} stars` : ''}`}
                style={styles.person}
              >
                <Face uri={photos[id] ?? null} name={name(id)} theme={theme} size={54} round />
                <Text style={[styles.personName, { color: theme.text }]} numberOfLines={1}>
                  {name(id)}
                </Text>
                <View style={styles.personMeta}>
                  {p.latest.rating ? <Stars rating={p.latest.rating} size={10} color={theme.star} /> : <Text style={[styles.small, { color: theme.textMuted }]}>seen</Text>}
                  {p.latest.liked && <Ionicons name="heart" size={10} color={theme.like} />}
                </View>
                {p.times > 1 && <Text style={[styles.small, { color: theme.textMuted }]}>{p.times}×</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {reviews.length > 0 && (
        <View style={styles.block}>
          <RowHead title={`Friends’ reviews (${reviews.length})`} theme={theme} />
          {reviews.map((e) => (
            <Review key={`${e.userId}:${e.id}`} e={e} who={name(e.userId)} photo={photos[e.userId] ?? null} theme={theme} />
          ))}
        </View>
      )}

      {data.lists.length > 0 && (
        <View style={styles.block}>
          <RowHead title="In friends’ lists" theme={theme} />
          <View style={styles.lists}>
            {data.lists.map((l) => (
              <Pressable
                key={`${l.userId}:${l.id}`}
                onPress={() => router.push({ pathname: '/friend-list', params: { friend: l.userId, list: l.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.listChip, { borderColor: theme.border, backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="albums-outline" size={15} color={theme.accent} />
                <Text style={[styles.listName, { color: theme.text }]} numberOfLines={1}>
                  {l.name}
                </Text>
                <Text style={[styles.small, { color: theme.textMuted }]}>{name(l.userId)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Review({ e, who, photo, theme }: { e: FriendEntry; who: string; photo: string | null; theme: Theme }) {
  const [reveal, setReveal] = useState(false);
  return (
    <View style={[styles.review, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.reviewHead}>
        <Face uri={photo} name={who} theme={theme} size={30} round />
        <Text style={[styles.reviewWho, { color: theme.text }]}>{who}</Text>
        {e.rating ? <Stars rating={e.rating} size={12} color={theme.star} /> : null}
        {e.liked && <Ionicons name="heart" size={12} color={theme.like} />}
        <Text style={[styles.small, { color: theme.textMuted, marginLeft: 'auto' }]}>{friendlyDate(e.watchedOn)}</Text>
      </View>
      {e.spoilers && !reveal ? (
        <Pressable onPress={() => setReveal(true)} accessibilityRole="button" style={styles.spoiler}>
          <Ionicons name="eye-off-outline" size={15} color={theme.textMuted} />
          <Text style={[styles.small, { color: theme.textMuted }]}>Contains spoilers. Tap to read.</Text>
        </Pressable>
      ) : (
        <RichText text={e.review} theme={theme} style={{ ...styles.reviewText, color: theme.text }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 22 },
  block: { gap: 10 },
  avg: { fontFamily: fonts.mono, fontSize: font.footnote },
  people: { gap: 14, paddingRight: 16 },
  person: { width: 64, alignItems: 'center', gap: 3 },
  personName: { fontSize: font.caption, fontWeight: '700', marginTop: 3 },
  personMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  small: { fontFamily: fonts.mono, fontSize: 10 },
  review: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewWho: { fontSize: font.footnote, fontWeight: '700' },
  reviewText: { fontSize: font.body, lineHeight: 22 },
  spoiler: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lists: { gap: 8 },
  listChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42 },
  listName: { flex: 1, fontSize: font.footnote, fontWeight: '700' },
});
