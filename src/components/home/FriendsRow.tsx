import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { cached, MINUTE } from '@/api/cache';
import { Poster } from '@/components/Film';
import { Face, RowHead, openTitle, warmTitle } from '@/components/title/Rows';
import { useFriends } from '@/friends/FriendsProvider';
import { friendsFeed } from '@/friends/friendsApi';
import type { FriendEntry } from '@/friends/friendsApi';
import { storage } from '@/lib/storage';
import { font, fonts } from '@/lib/theme';
import { viewingRating, watchedLabel } from '@/lib/watched';
import type { Theme } from '@/lib/theme';
import type { Title } from '@/store/types';

/** Whether the row showed last time ("1" or "0"), so its place is kept while it loads. No friend data. */
const SHOWN_KEY = 'home:friendsRow';
const POSTER = 104;

/**
 * Home's "Friends lately": what your friends watched most recently, each poster with their face and
 * stars, like Letterboxd's friends row. Only for an account with friends; hidden otherwise.
 *
 * It comes from the network after the rows below it, so it would pop in above Up next. When it showed
 * last time, grey shapes hold its place until it loads; a refresh (`round`) keeps the old row on screen
 * until the new one is in.
 */
export function FriendsRow({ theme, round }: { theme: Theme; round: number }) {
  const { available, friends, photos, byId, loading } = useFriends();
  const [feed, setFeed] = useState<FriendEntry[] | null>(null);
  const [shownLast, setShownLast] = useState<boolean | null>(null);
  const has = available && friends.length > 0;

  useEffect(() => {
    storage
      .getItem(SHOWN_KEY)
      .then((v) => setShownLast(v === '1'))
      .catch(() => setShownLast(false));
  }, []);

  useEffect(() => {
    if (!has) return;
    let live = true;
    // Kept for five minutes, so moving between tabs doesn't ask again (pull to refresh clears it).
    cached('friends-feed', 5 * MINUTE, friendsFeed)
      .then((f) => {
        if (!live) return;
        setFeed(f.slice(0, 20));
        storage.setItem(SHOWN_KEY, f.length ? '1' : '0').catch(() => {});
      })
      // Offline: what's on screen stays.
      .catch(() => live && setFeed((old) => old ?? []));
    return () => {
      live = false;
    };
  }, [has, friends.length, round]);

  // Signed out, or no friends after all: nothing to keep a place for next time.
  const none = !available || (!loading && friends.length === 0);
  useEffect(() => {
    if (none) storage.setItem(SHOWN_KEY, '0').catch(() => {});
  }, [none]);

  if (none) return null;
  if (!feed?.length) {
    const waiting = shownLast && (loading || (has && feed === null));
    return waiting ? <Placeholder theme={theme} /> : null;
  }
  return (
    <View style={styles.block}>
      <RowHead title="Friends lately" theme={theme} more="All" onMore={() => router.push('/friends')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {feed.map((e) => {
          const who = byId(e.userId);
          const name = who?.name ?? 'A friend';
          const what = watchedLabel(e);
          const rating = viewingRating(e);
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
              accessibilityLabel={`${name} watched ${what ? `${what} of ` : ''}${e.title}${rating ? `, ${rating / 2} stars` : ''}`}
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
              {!!what && (
                <Text style={[styles.what, { color: theme.accent }]} numberOfLines={1}>
                  {what}
                </Text>
              )}
              <View style={styles.meta}>
                {!!rating && (
                  <Text style={[styles.stars, { color: theme.star }]}>
                    {'★'.repeat(Math.floor(rating / 2))}
                    {rating % 2 ? '½' : ''}
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

/** The row's shape in grey, the same height as the row. */
function Placeholder({ theme }: { theme: Theme }) {
  return (
    <View style={styles.block} accessibilityLabel="Friends lately, loading">
      <RowHead title="Friends lately" theme={theme} />
      <View style={[styles.row, styles.ghostRow]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: POSTER }}>
            <View style={{ width: POSTER, height: POSTER * 1.5, borderRadius: 6, backgroundColor: theme.card }} />
            <View style={[styles.ghostLine, { backgroundColor: theme.card, width: POSTER * 0.8 }]} />
            <View style={[styles.ghostLine, { backgroundColor: theme.card, width: POSTER * 0.5 }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  ghostRow: { flexDirection: 'row', overflow: 'hidden' },
  ghostLine: { height: 12, borderRadius: 4, marginTop: 10 },
  row: { gap: 12, paddingRight: 16 },
  face: { position: 'absolute', right: -4, bottom: -6, borderRadius: 16, borderWidth: 2 },
  name: { fontSize: font.footnote, fontWeight: '700', marginTop: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  stars: { fontSize: 12 },
  what: { fontFamily: fonts.monoBold, fontSize: 12 },
  who: { fontFamily: fonts.mono, fontSize: font.caption, flexShrink: 1 },
});
