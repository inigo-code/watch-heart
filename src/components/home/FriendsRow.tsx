import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { cached, MINUTE } from '@/api/cache';
import { Poster } from '@/components/Film';
import { Face, RowHead, openTitle, rail, warmTitle } from '@/components/title/Rows';
import { useFriends } from '@/friends/FriendsProvider';
import { friendsFeed } from '@/friends/friendsApi';
import type { FriendEntry } from '@/friends/friendsApi';
import { storage } from '@/lib/storage';
import { useSettings } from '@/settings/SettingsProvider';
import { useSync } from '@/sync/SyncProvider';
import { font, fonts } from '@/lib/theme';
import { viewingRating, watchedLabel } from '@/lib/watched';
import type { Theme } from '@/lib/theme';
import type { Title } from '@/store/types';

/** Whether the row showed last time ("1" or "0"), so its place is kept while it loads. No friend data. */
const SHOWN_KEY = 'home:friendsRow';
/**
 * The last feed, with your friends' names, so the row is there at once on the next launch while the new
 * one loads. Only for the account that saved it, and never kept with App lock on.
 */
const FEED_KEY = 'home:friendsFeed';
type Saved = { owner: string; items: FriendEntry[]; names: Record<string, string> };
const POSTER = 104;

/**
 * Home's "Friends lately": what your friends watched most recently, each poster with their face and
 * stars, like Letterboxd's friends row. Only for an account with friends; hidden otherwise.
 *
 * The last feed is kept on the phone (`FEED_KEY`) and shown at once; the new one, asked for as soon as
 * you're signed in (not after your friends list), replaces it. With nothing kept and the row there last
 * time, grey shapes hold its place, so Up next doesn't jump; a refresh (`round`) keeps the old row on
 * screen until the new one is in.
 */
export function FriendsRow({ theme, round }: { theme: Theme; round: number }) {
  const { available, friends, photos, byId, loading } = useFriends();
  const { email, authChecked } = useSync();
  const { settings, ready } = useSettings();
  // The feed may be kept on the phone: settings are read, and App lock is off.
  const keep = ready && !settings.appLock;
  const [feed, setFeed] = useState<FriendEntry[] | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [offline, setOffline] = useState(false);
  const [shownLast, setShownLast] = useState<boolean | null>(null);
  const has = available && friends.length > 0;

  useEffect(() => {
    storage
      .getItem(SHOWN_KEY)
      .then((v) => setShownLast(v === '1'))
      .catch(() => setShownLast(false));
  }, []);

  useEffect(() => {
    if (!email || !ready) return;
    if (!keep) {
      storage.removeItem(FEED_KEY).catch(() => {});
      return;
    }
    let live = true;
    storage
      .getItem(FEED_KEY)
      .then((raw) => {
        const last = raw ? (JSON.parse(raw) as Saved) : null;
        if (live && last?.owner === email) setSaved(last);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [email, ready, keep]);

  useEffect(() => {
    if (!available || !email) return;
    let live = true;
    // Kept for five minutes, so moving between tabs doesn't ask again (pull to refresh clears it).
    cached(`friends-feed:${email}`, 5 * MINUTE, friendsFeed)
      .then((f) => {
        if (!live) return;
        setFeed(f.slice(0, 20));
        setOffline(false);
        storage.setItem(SHOWN_KEY, f.length ? '1' : '0').catch(() => {});
      })
      // Offline: what's on screen (or kept from last time) stays.
      .catch(() => live && setOffline(true));
    return () => {
      live = false;
    };
  }, [available, email, friends.length, round]);

  // Keeps the new feed for next time, with names, once your friends are in.
  useEffect(() => {
    if (!keep || !email || !feed || loading) return;
    const names = Object.fromEntries(friends.map((f) => [f.id, f.name]));
    storage.setItem(FEED_KEY, JSON.stringify({ owner: email, items: feed, names } satisfies Saved)).catch(() => {});
  }, [keep, email, feed, loading, friends]);

  // Signed out, or no friends after all: nothing to keep a place for next time. At launch the sign-in
  // is still being restored, so nothing is forgotten until it's been looked for.
  const none = authChecked && (!available || (!loading && friends.length === 0));
  useEffect(() => {
    if (!none) return;
    storage.setItem(SHOWN_KEY, '0').catch(() => {});
    storage.removeItem(FEED_KEY).catch(() => {});
  }, [none]);

  // The new feed once it's in; until then the kept one, less anyone who's no longer a friend.
  const shown = feed ?? (saved && (loading ? saved.items : saved.items.filter((e) => byId(e.userId))));
  if (none) return null;
  if (!shown?.length) {
    const waiting = shownLast && !offline && (!authChecked || loading || (has && feed === null));
    return waiting ? <Placeholder theme={theme} /> : null;
  }
  return (
    <View style={styles.block}>
      <RowHead title="Friends lately" theme={theme} more="All" onMore={() => router.push('/friends')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={rail.edge} contentContainerStyle={styles.row}>
        {shown.map((e) => {
          const name = byId(e.userId)?.name ?? saved?.names[e.userId] ?? 'A friend';
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
                <Text style={[styles.what, { color: theme.textMuted }]} numberOfLines={1}>
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
  row: { gap: 12, paddingHorizontal: 16 },
  face: { position: 'absolute', right: -4, bottom: -6, borderRadius: 16, borderWidth: 2 },
  name: { fontSize: font.footnote, fontWeight: '600', marginTop: 8, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  stars: { fontSize: 12 },
  what: { fontFamily: fonts.uiSemibold, fontSize: 12 },
  who: { fontFamily: fonts.ui, fontSize: font.caption, flexShrink: 1 },
});
