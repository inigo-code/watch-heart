import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ActionSheet';
import { Text } from '@/components/AppText';
import { DangerButton } from '@/components/DangerButton';
import { usePullRefresh } from '@/components/PullRefresh';
import { SectionLabel } from '@/components/SectionLabel';
import { Face, TitleRow } from '@/components/title/Rows';
import { useConfirm } from '@/components/Confirm';
import { useToast } from '@/components/Toast';
import { answerFriendRequest, blockPerson, cancelFriendRequest, personPreview, photoUrl, sendFriendRequest } from '@/friends/friendsApi';
import type { PersonPreview } from '@/friends/friendsApi';
import { useFriends } from '@/friends/FriendsProvider';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Title } from '@/store/types';
import { shownError } from '@/lib/errors';

const asTitle = (f: PersonPreview['favourites'][number]) =>
  ({ kind: f.kind, source: f.source, sourceId: f.sourceId, title: f.title, year: f.year, posterUrl: f.posterUrl, backdropUrl: null, genres: [], runtime: null }) as Title;

/** A look at someone before you're friends: who they are, never their diary, reviews or lists. */
export default function SomeoneScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const askFirst = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh, forgetRequest } = useFriends();
  const [person, setPerson] = useState<PersonPreview | null | undefined>(undefined);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(
    () =>
      personPreview(id)
        .then(async (p) => {
          setPhoto(p?.photoPath ? await photoUrl(p.photoPath) : null);
          setPerson(p);
        })
        .catch(() => setPerson(null)),
    [id],
  );
  useEffect(() => {
    load().catch(() => {});
  }, [load]);
  const pull = usePullRefresh(theme, load);

  if (person === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  if (!person) {
    return (
      <View style={styles.center}>
        <Text style={[styles.note, { color: theme.textMuted }]}>This profile isn’t available</Text>
      </View>
    );
  }

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      toast(shownError(e, 'No connection. Try again in a moment.'));
    } finally {
      setBusy(false);
    }
  };
  const nowFriends = async () => {
    forgetRequest(person.id);
    await refresh();
    toast(`You and ${person.name} are friends now`);
    router.replace({ pathname: '/friend/[id]', params: { id: person.id } });
  };
  const ask = () =>
    act(async () => {
      if ((await sendFriendRequest(person.id)) === 'friends') return nowFriends();
      setPerson({ ...person, status: 'sent' });
      toast(`Asked ${person.name}`);
    });
  const takeBack = () =>
    askFirst({ title: `Take back your friend request to ${person.name}?`, label: 'Take it back', icon: 'arrow-undo-outline', onConfirm: () => void takeBackNow() });
  const takeBackNow = () =>
    act(async () => {
      await cancelFriendRequest(person.id);
      setPerson({ ...person, status: 'none' });
    });
  const answer = (accept: boolean) =>
    act(async () => {
      await answerFriendRequest(person.id, accept);
      if (accept) return nowFriends();
      forgetRequest(person.id);
      router.back();
    });
  const block = () =>
    act(async () => {
      await blockPerson(person.id);
      forgetRequest(person.id);
      toast(`Blocked ${person.name}`);
      router.back();
      await refresh(true);
    });

  const button = (label: string, onPress: () => void, solid = true) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.action, solid ? { backgroundColor: theme.accent } : { borderWidth: 1, borderColor: theme.border }]}
    >
      <Text style={[styles.actionText, { color: solid ? theme.accentText : theme.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} refreshControl={pull}>
      <View style={styles.who}>
        <Face uri={photo} name={person.name} theme={theme} size={96} round />
        <Text style={[styles.name, { color: theme.text }]}>{person.name}</Text>
        {!!person.bio && <Text style={[styles.bio, { color: theme.textMuted }]}>{person.bio}</Text>}
        {person.titles > 0 && (
          <Text style={[styles.count, { color: theme.textMuted }]}>
            {person.titles} {person.titles === 1 ? 'title' : 'titles'} logged
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        {busy ? (
          <ActivityIndicator color={theme.accent} />
        ) : person.status === 'received' ? (
          <>
            {button('Decline', () => askFirst({ title: `Decline ${person.name}’s friend request?`, label: 'Decline', icon: 'close-circle-outline', onConfirm: () => void answer(false) }), false)}
            {button('Accept', () => answer(true))}
          </>
        ) : person.status === 'sent' ? (
          button('Requested', takeBack, false)
        ) : person.status === 'friends' ? (
          button('Open their diary', () => router.replace({ pathname: '/friend/[id]', params: { id: person.id } }))
        ) : (
          button('Add friend', ask)
        )}
      </View>

      {person.favourites.length > 0 && (
        <View style={styles.favourites}>
          <SectionLabel theme={theme}>Favourites</SectionLabel>
          <TitleRow titles={person.favourites.map(asTitle)} theme={theme} width={84} />
        </View>
      )}

      {person.status !== 'friends' && <Text style={[styles.note, { color: theme.textMuted }]}>Their diary, reviews and lists stay private until you’re friends</Text>}

      <DangerButton theme={theme} icon="ban-outline" label={`Block ${person.name}`} onPress={() => setConfirm(true)} />
      <ActionSheet
        visible={confirm}
        title={`Block ${person.name}? They won’t be able to find you, ask you or use your code. They aren’t told.`}
        actions={[{ label: `Block ${person.name}`, icon: 'ban-outline', destructive: true, onPress: block }]}
        onClose={() => setConfirm(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  content: { padding: 16, gap: 22 },
  who: { alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.uiBold, fontSize: font.title2, textAlign: 'center' },
  bio: { fontSize: font.footnote, lineHeight: 20, textAlign: 'center' },
  count: { fontFamily: fonts.ui, fontSize: font.caption },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 10, minHeight: 46 },
  action: { flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: fonts.uiSemibold, fontSize: font.footnote },
  favourites: { gap: 10 },
  note: { fontFamily: fonts.ui, fontSize: font.caption, lineHeight: 17, textAlign: 'center' },
});
