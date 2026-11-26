import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { Poster, Stars } from '@/components/Film';
import { Conversation, SocialBar } from '@/components/friends/Social';
import { RichText } from '@/components/RichText';
import { Face, openTitle } from '@/components/title/Rows';
import { useFriends } from '@/friends/FriendsProvider';
import { friendEntry, socialKey } from '@/friends/socialApi';
import { friendEntryCache } from '@/friends/useSocial';
import { friendlyDate } from '@/lib/dates';
import { shownError } from '@/lib/errors';
import { easeNextLayout } from '@/lib/motion';
import { font, fonts, useTheme } from '@/lib/theme';
import { viewingRating, watchedLabel } from '@/lib/watched';
import type { Entry } from '@/store/types';

/** One of a friend's diary entries: what they watched, what they thought, and the conversation on it. */
export default function FriendEntryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id, owner, write } = useLocalSearchParams<{ id: string; owner: string; write?: string }>();
  const { byId, photos } = useFriends();
  const [entry, setEntry] = useState<Entry | null | undefined>(() => friendEntryCache.get(socialKey(owner, id)));
  const [failed, setFailed] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  // Comment (on a card, or here) opens the box.
  const [writing, setWriting] = useState(!!write);
  const who = byId(owner);
  const name = who?.name ?? 'Your friend';

  useEffect(() => {
    let live = true;
    friendEntry(owner, id)
      .then((e) => {
        if (!live) return;
        setEntry(e);
        if (e) friendEntryCache.set(socialKey(owner, id), e);
      })
      .catch((e: unknown) => live && setFailed(shownError(e, 'Couldn’t open this entry.')));
    return () => {
      live = false;
    };
  }, [owner, id]);

  if (entry === undefined)
    return <View style={styles.center}>{failed ? <Text style={[styles.meta, { color: theme.textMuted }]}>{failed}</Text> : <ActivityIndicator color={theme.accent} />}</View>;
  if (entry === null)
    return (
      <View style={styles.center}>
        <Text style={[styles.meta, { color: theme.textMuted, textAlign: 'center' }]}>This entry isn’t shared with you any more. It may have been deleted.</Text>
      </View>
    );

  const rating = viewingRating(entry);
  const what = watchedLabel(entry);
  const hidden = entry.spoilers && !reveal;
  const openIt = () =>
    openTitle({
      kind: entry.kind,
      source: entry.source,
      sourceId: entry.sourceId,
      title: entry.title,
      year: entry.year,
      posterUrl: entry.posterUrl,
      backdropUrl: entry.backdropUrl,
      genres: entry.genres,
      runtime: entry.runtime,
      credit: entry.credit,
    });

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: `${name}’s entry` }} />
      <Pressable
        onPress={() => router.push({ pathname: '/friend/[id]', params: { id: owner } })}
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}
        style={styles.who}
      >
        <Face uri={photos[owner] ?? null} name={name} theme={theme} size={36} round />
        <View style={{ flex: 1 }}>
          <Text style={[styles.whoName, { color: theme.text }]}>{name}</Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {entry.rewatch ? 'Rewatched' : 'Watched'} {entry.undated ? 'on a day they don’t remember' : friendlyDate(entry.watchedOn)}
          </Text>
        </View>
      </Pressable>

      <Pressable onPress={openIt} accessibilityRole="button" accessibilityLabel={`${entry.title}, open its page`} style={[styles.film, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Poster uri={entry.posterUrl} title={entry.title} width={72} theme={theme} radius={6} />
        <View style={styles.filmText}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={3}>
            {entry.title}
            {entry.year ? <Text style={{ color: theme.textMuted, fontFamily: fonts.ui }}>{`  ${entry.year}`}</Text> : null}
          </Text>
          {!!what && <Text style={[styles.meta, { color: theme.textMuted }]}>{what}</Text>}
          <View style={styles.marks}>
            {rating ? <Stars rating={rating} size={16} color={theme.star} /> : null}
            {entry.liked && <Ionicons name="heart" size={16} color={theme.like} accessibilityLabel="Loved it" />}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </Pressable>

      {!!entry.review &&
        (hidden ? (
          <Pressable
            onPress={() => {
              easeNextLayout();
              setReveal(true);
            }}
            accessibilityRole="button"
            style={[styles.spoiler, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Ionicons name="eye-off-outline" size={18} color={theme.textMuted} />
            <Text style={[styles.meta, { color: theme.textMuted }]}>Contains spoilers. Tap to read.</Text>
          </Pressable>
        ) : (
          <RichText text={entry.review} theme={theme} style={{ ...styles.review, color: theme.text }} />
        ))}

      <SocialBar ownerId={owner} entryId={id} theme={theme} onComment={() => setWriting(true)} />
      <Conversation ownerId={owner} entryId={id} theme={theme} ownerName={name.split(' ')[0]} writing={writing} onWriting={setWriting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  body: { padding: 16, gap: 18 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  whoName: { fontFamily: fonts.uiSemibold, fontSize: font.body },
  meta: { fontFamily: fonts.ui, fontSize: font.footnote },
  film: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 12, padding: 12 },
  filmText: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.uiBold, fontSize: font.title, lineHeight: 25 },
  marks: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 18 },
  spoiler: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 14 },
  review: { fontFamily: fonts.ui, fontSize: font.body, lineHeight: 24 },
});
