import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { cached, MINUTE } from '@/api/cache';
import { Poster } from '@/components/Film';
import { Face, RowHead, openTitle, warmTitle } from '@/components/title/Rows';
import { useFriends } from '@/friends/FriendsProvider';
import { friendsFeed } from '@/friends/friendsApi';
import type { FriendEntry } from '@/friends/friendsApi';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { Title } from '@/store/types';

/**
 * Home's "Friends lately": what your friends watched most recently, each poster with their face and
 * stars, like Letterboxd's friends row. Only for an account with friends; hidden otherwise.
 */
export function FriendsRow({ theme }: { theme: Theme }) {
  const { available, friends, photos, byId } = useFriends();
  const [feed, setFeed] = useState<FriendEntry[] | null>(null);
  const has = available && friends.length > 0;

  useEffect(() => {
    if (!has) return;
    let live = true;
    // Kept for five minutes, so moving between tabs doesn't ask again.
    cached('friends-feed', 5 * MINUTE, friendsFeed)
      .then((f) => live && setFeed(f.slice(0, 20)))
      .catch(() => live && setFeed([]));
    return () => {
      live = false;
    };
  }, [has, friends.length]);

  if (!has || !feed?.length) return null;
  return (
    <View style={styles.block}>
      <RowHead title="Friends lately" theme={theme} more="All" onMore={() => router.push('/friends')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {feed.map((e) => {
          const who = byId(e.userId);
          const name = who?.name ?? 'A friend';
          const t: Title = {
            kind: e.kind,
            source: e.source,
            sourceId: e.sourceId,
            title: e.title,
            originalTitle: e.originalTitle ?? undefined,
            year: e.year,
            posterUrl: e.posterUrl,
            backdropUrl: e.backdropUrl,
            genres: e.genres,
            runtime: e.runtime,
          };
          return (
            <Pressable
              key={`${e.userId}:${e.id}`}
              onPressIn={() => warmTitle(t)}
              onPress={() => openTitle(t)}
              accessibilityRole="button"
              accessibilityLabel={`${name} watched ${e.title}${e.rating ? `, ${e.rating / 2} stars` : ''}`}
              style={({ pressed }) => [{ width: 104 }, pressed && { opacity: 0.8 }]}
            >
              <View>
                <Poster uri={e.posterUrl} title={e.title} width={104} theme={theme} radius={6} />
                <View style={[styles.face, { borderColor: theme.bg }]}>
                  <Face uri={photos[e.userId] ?? null} name={name} theme={theme} size={28} round />
                </View>
              </View>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {e.title}
              </Text>
              <View style={styles.meta}>
                {!!e.rating && (
                  <Text style={[styles.stars, { color: theme.star }]}>
                    {'★'.repeat(Math.floor(e.rating / 2))}
                    {e.rating % 2 ? '½' : ''}
                  </Text>
                )}
                {e.liked && <Ionicons name="heart" size={11} color={theme.like} />}
                <Text style={[styles.who, { color: theme.textMuted }]} numberOfLines={1}>
                  {name.split(' ')[0]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  row: { gap: 12, paddingRight: 16 },
  face: { position: 'absolute', right: -4, bottom: -6, borderRadius: 16, borderWidth: 2 },
  name: { fontSize: font.footnote, fontWeight: '700', marginTop: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  stars: { fontSize: 11 },
  who: { fontFamily: fonts.mono, fontSize: font.caption, flexShrink: 1 },
});
