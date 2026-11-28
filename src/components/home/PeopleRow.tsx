import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { useConfirm } from '@/components/Confirm';
import { Face, RowHead } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { cancelFriendRequest, photoUrl, sendFriendRequest, suggestPeople } from '@/friends/friendsApi';
import type { Suggestion } from '@/friends/friendsApi';
import { useFriends } from '@/friends/FriendsProvider';
import { shownError } from '@/lib/errors';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

// Shown while you have fewer friends than this; after that, Friends is the place for more.
const UNDER = 5;
const MOST = 6;
const CARD = 128;

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
/** Why someone is suggested, short enough for a card: friends you share first, then titles. */
const why = (p: Suggestion) => (p.mutual ? `${plural(p.mutual, 'friend')} in common` : p.common ? `${plural(p.common, 'title')} in common` : '');

/**
 * Home's "People you might know", as on the website: up to six people (friends of friends, and people with the
 * same titles when both allow it), each with an Add button. Only while you have fewer than five friends, and
 * only when there's someone to suggest; the full list and search stay in Friends.
 */
export function PeopleRow({ theme, round }: { theme: Theme; round: number }) {
  const toast = useToast();
  const askFirst = useConfirm();
  const { available, peopleReady, friends, loading, refresh } = useFriends();
  const [people, setPeople] = useState<Suggestion[]>([]);
  const [faces, setFaces] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const wanted = available && peopleReady && !loading && friends.length < UNDER;

  useEffect(() => {
    if (!wanted) return;
    let live = true;
    suggestPeople()
      .then(async (found) => {
        if (!live) return;
        const some = found.slice(0, MOST);
        setPeople(some);
        const links = await Promise.all(some.map(async (p) => [p.id, p.photoPath ? await photoUrl(p.photoPath) : null] as const));
        const fresh: Record<string, string> = {};
        for (const [id, url] of links) if (url) fresh[id] = url;
        if (live) setFaces((f) => ({ ...f, ...fresh }));
      })
      .catch(() => live && setPeople([]));
    return () => {
      live = false;
    };
  }, [wanted, round]);

  if (!wanted || people.length === 0) return null;

  const ask = async (p: Suggestion) => {
    setBusy(p.id);
    try {
      if (p.status === 'sent') {
        await cancelFriendRequest(p.id);
        setPeople((list) => list.map((x) => (x.id === p.id ? { ...x, status: 'none' } : x)));
      } else {
        const r = await sendFriendRequest(p.id);
        if (r === 'friends') {
          setPeople((list) => list.filter((x) => x.id !== p.id));
          toast(`You and ${p.name} are friends now`);
          void refresh(true);
        } else {
          setPeople((list) => list.map((x) => (x.id === p.id ? { ...x, status: 'sent' } : x)));
          toast(`Asked ${p.name}`);
        }
      }
    } catch (e) {
      toast(shownError(e, 'No connection. Try again in a moment.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.block}>
      <RowHead title="People you might know" theme={theme} more="Friends" onMore={() => router.push('/friends')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {people.map((p) => {
          const sent = p.status === 'sent';
          const reason = why(p) || p.bio;
          return (
            <View key={p.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Pressable
                onPress={p.previewable ? () => router.push({ pathname: '/someone/[id]', params: { id: p.id } }) : undefined}
                disabled={!p.previewable}
                accessibilityRole={p.previewable ? 'button' : undefined}
                accessibilityLabel={p.previewable ? `See ${p.name}’s profile` : p.name}
                style={styles.who}
              >
                <Face uri={faces[p.id] ?? null} name={p.name} theme={theme} size={56} round />
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={[styles.why, { color: why(p) ? theme.accent : theme.textMuted }]} numberOfLines={2}>
                  {reason || ' '}
                </Text>
                {/* Otherwise the card simply doesn't open, which reads as a missed tap. */}
                {!p.previewable && (
                  <Text style={[styles.hidden, { color: theme.textMuted }]} numberOfLines={1}>
                    Profile not shown
                  </Text>
                )}
              </Pressable>
              {busy === p.id ? (
                <View style={styles.btn}>
                  <ActivityIndicator color={theme.accent} />
                </View>
              ) : (
                <Pressable
                  onPress={() =>
                    sent
                      ? askFirst({ title: `Take back your friend request to ${p.name}?`, label: 'Take it back', icon: 'arrow-undo-outline', onConfirm: () => void ask(p) })
                      : void ask(p)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={sent ? `Take back your request to ${p.name}` : p.status === 'received' ? `Accept ${p.name}` : `Ask ${p.name} to be friends`}
                  style={({ pressed }) => [styles.btn, sent ? { borderWidth: 1, borderColor: theme.border } : { backgroundColor: theme.accent }, pressed && { opacity: 0.75 }]}
                >
                  <Text style={[styles.btnText, { color: sent ? theme.text : theme.accentText }]}>{sent ? 'Requested' : p.status === 'received' ? 'Accept' : 'Add'}</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  row: { gap: 10, paddingRight: 16 },
  card: { width: CARD, borderWidth: 1, borderRadius: 14, padding: 10, gap: 10, alignItems: 'center' },
  who: { alignItems: 'center', gap: 4, alignSelf: 'stretch' },
  name: { fontSize: font.footnote, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  why: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 15, textAlign: 'center', minHeight: 30 },
  hidden: { fontFamily: fonts.ui, fontSize: 11, lineHeight: 14, textAlign: 'center' },
  btn: { alignSelf: 'stretch', minHeight: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.uiSemibold, fontSize: font.caption },
});
