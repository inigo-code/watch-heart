import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/AppText';
import { ActionSheet } from '@/components/ActionSheet';
import { BlockedPeople } from '@/components/friends/BlockedPeople';
import { FriendsStrip } from '@/components/friends/FriendsStrip';
import { PeopleSearch } from '@/components/friends/PeopleSearch';
import { Stars } from '@/components/Film';
import { KeyboardSafe } from '@/components/KeyboardSafe';
import { SectionLabel } from '@/components/SectionLabel';
import { Face, openTitle } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { formatCode, friendsFeed, myInviteCode, redeemInvite } from '@/friends/friendsApi';
import type { FriendEntry } from '@/friends/friendsApi';
import { useFriends } from '@/friends/FriendsProvider';
import { SITE_URL } from '@/lib/app';
import { friendlyDate } from '@/lib/dates';
import { easeNextLayout } from '@/lib/motion';
import { font, fonts, useTheme } from '@/lib/theme';
import { viewingRating, watchedLabel } from '@/lib/watched';
import type { Theme } from '@/lib/theme';

/** Your friends as a row of faces, requests, adding someone by code or name, and what friends watched lately. */
export default function FriendsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ code?: string }>();
  const { available, friends, loading, refresh } = useFriends();
  const [code, setCode] = useState<string | null>(null);
  const [codeFailed, setCodeFailed] = useState(false);
  const [entry, setEntry] = useState(params.code ?? '');
  const [adding, setAdding] = useState(false);
  const [feed, setFeed] = useState<FriendEntry[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // Add stays open for someone with no friends yet, until they close it.
  const [addOpen, setAddOpen] = useState<boolean | null>(params.code ? true : null);
  const showAdd = addOpen ?? (!loading && !friends.length);
  const [round, setRound] = useState(0);

  // A second invite link can arrive while this page is already open.
  const [lastCode, setLastCode] = useState(params.code);
  if (params.code !== lastCode) {
    setLastCode(params.code);
    if (params.code) {
      setEntry(params.code);
      setAddOpen(true);
    }
  }

  const loadCode = useCallback(
    () =>
      myInviteCode()
        .then((c) => {
          setCode(c);
          setCodeFailed(false);
        })
        .catch(() => setCodeFailed(true)),
    [],
  );

  useEffect(() => {
    if (!available) return;
    loadCode().catch(() => {});
    friendsFeed()
      .then(setFeed)
      .catch(() => setFeed([]));
  }, [available, loadCode]);

  // Requests and new friends can arrive at any time: look again whenever this page comes up.
  useFocusEffect(
    useCallback(() => {
      if (available) refresh(true).catch(() => {});
    }, [available, refresh]),
  );

  if (!available) {
    return (
      <View style={styles.center}>
        <Ionicons name="people-outline" size={44} color={theme.accent} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>FRIENDS NEED AN ACCOUNT</Text>
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>
          Sign in (or make a free account) to get your invite code, add friends by theirs, and see what they’re watching.
        </Text>
        <Pressable onPress={() => router.push('/account')} accessibilityRole="button" style={[styles.primary, { backgroundColor: theme.accent }]}>
          <Text style={[styles.primaryText, { color: theme.accentText }]}>SIGN IN</Text>
        </Pressable>
      </View>
    );
  }

  const add = async () => {
    if (!entry.trim() || adding) return;
    setAdding(true);
    try {
      const id = await redeemInvite(entry);
      const already = friends.some((f) => f.id === id);
      setEntry('');
      await refresh();
      friendsFeed()
        .then(setFeed)
        .catch(() => {});
      toast(already ? 'You’re already friends' : 'You’re friends now');
      if (!already) setAddOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t add that code');
    } finally {
      setAdding(false);
    }
  };

  const share = () =>
    code &&
    Share.share({
      message: `Add me on Watch Heart, the film and series diary: my invite code is ${formatCode(code)}\n${SITE_URL}invite.html?code=${code}`,
    }).catch(() => {});

  const reload = async () => {
    setRound((r) => r + 1);
    await Promise.all([refresh(), code ? null : loadCode()]);
    setFeed(await friendsFeed().catch(() => []));
  };

  const toggleAdd = () => {
    easeNextLayout();
    setAddOpen(!showAdd);
  };

  return (
    <KeyboardSafe>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={theme.accent} colors={[theme.accent]} />}
      >
        <FriendsStrip theme={theme} adding={showAdd} onAdd={toggleAdd} />

        {showAdd && (
          <View style={styles.block}>
            <View style={[styles.codeCard, { backgroundColor: theme.card, borderColor: theme.accent }]}>
              <Text style={[styles.codeLabel, { color: theme.textMuted }]}>YOUR INVITE CODE</Text>
              {code ? (
                <Text style={[styles.code, { color: theme.text }]} selectable accessibilityLabel={`Your invite code: ${code.split('').join(' ')}`}>
                  {formatCode(code)}
                </Text>
              ) : codeFailed ? (
                <Pressable onPress={() => loadCode()} accessibilityRole="button" hitSlop={8} style={{ marginVertical: 14 }}>
                  <Text style={[styles.hint, { color: theme.accent }]}>Couldn’t load your code. Tap to try again.</Text>
                </Pressable>
              ) : (
                <ActivityIndicator color={theme.accent} style={{ marginVertical: 14 }} />
              )}
              <Text style={[styles.hint, { color: theme.textMuted }]}>Share it only with people you know</Text>
              <View style={styles.codeButtons}>
                <Pressable onPress={share} disabled={!code} accessibilityRole="button" style={[styles.primary, styles.grow, { backgroundColor: theme.accent }]}>
                  <Ionicons name="share-social-outline" size={18} color={theme.accentText} />
                  <Text style={[styles.primaryText, { color: theme.accentText }]}>SHARE</Text>
                </Pressable>
                <Pressable onPress={() => setConfirmReset(true)} disabled={!code} accessibilityRole="button" style={[styles.secondary, { borderColor: theme.border }]}>
                  <Ionicons name="refresh" size={17} color={theme.text} />
                  <Text style={[styles.secondaryText, { color: theme.text }]}>NEW CODE</Text>
                </Pressable>
              </View>
            </View>
            <SectionLabel theme={theme}>Add by their code</SectionLabel>
            <View style={styles.addRow}>
              <TextInput
                value={entry}
                onChangeText={setEntry}
                placeholder="e.g. K7QF-29MZ"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                returnKeyType="done"
                onSubmitEditing={add}
                style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
              />
              <Pressable
                onPress={add}
                disabled={!entry.trim() || adding}
                accessibilityRole="button"
                style={[styles.addBtn, { backgroundColor: theme.accent, opacity: !entry.trim() || adding ? 0.5 : 1 }]}
              >
                {adding ? <ActivityIndicator color={theme.accentText} /> : <Text style={[styles.primaryText, { color: theme.accentText }]}>ADD</Text>}
              </Pressable>
            </View>
          </View>
        )}

        <PeopleSearch theme={theme} onFriendsChanged={reload} />

        {friends.length > 0 && (
          <View style={styles.block}>
            <SectionLabel theme={theme}>Lately</SectionLabel>
            {feed === null ? (
              <ActivityIndicator color={theme.accent} />
            ) : feed.length === 0 ? (
              <Text style={[styles.hint, { color: theme.textMuted }]}>Nothing logged by your friends yet.</Text>
            ) : (
              feed.slice(0, 40).map((e) => <FeedRow key={`${e.userId}:${e.id}`} e={e} theme={theme} />)
            )}
          </View>
        )}

        <BlockedPeople theme={theme} round={round} />
      </ScrollView>
      <ActionSheet
        visible={confirmReset}
        title="Make a new code? Your current one stops working, so anyone you gave it to will need the new one, and anyone you unfriended can use the new one if they get it. Friends you have stay friends."
        actions={[
          {
            label: 'Make a new code',
            icon: 'refresh',
            destructive: true,
            onPress: () =>
              myInviteCode(true)
                .then((c) => {
                  setCode(c);
                  toast('New code ready');
                })
                .catch((e) => toast(e instanceof Error ? e.message : 'Couldn’t make a new code')),
          },
        ]}
        onClose={() => setConfirmReset(false)}
      />
    </KeyboardSafe>
  );
}

/** "Sam · Past Lives ★★★★½ · Sat 24 Oct": opens the title. */
function FeedRow({ e, theme }: { e: FriendEntry; theme: Theme }) {
  const what = watchedLabel(e);
  const rating = viewingRating(e);
  const { byId, photos } = useFriends();
  const who = byId(e.userId);
  return (
    <Pressable
      onPress={() =>
        openTitle({
          kind: e.kind,
          source: e.source,
          sourceId: e.sourceId,
          title: e.title,
          year: e.year,
          posterUrl: e.posterUrl,
          backdropUrl: e.backdropUrl,
          genres: e.genres,
          runtime: e.runtime,
          credit: e.credit,
        })
      }
      accessibilityRole="button"
      style={({ pressed }) => [styles.feedRow, { borderBottomColor: theme.border, opacity: pressed ? 0.75 : 1 }]}
    >
      <Pressable
        onPress={() => router.push({ pathname: '/friend/[id]', params: { id: e.userId } })}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Open ${who?.name ?? 'your friend'}`}
      >
        <Face uri={photos[e.userId] ?? null} name={who?.name ?? '?'} theme={theme} size={34} round />
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.feedText, { color: theme.text }]} numberOfLines={2}>
          <Text style={{ fontWeight: '700' }}>{who?.name ?? 'A friend'}</Text>
          {e.rewatch ? ' rewatched ' : ' watched '}
          {what ? `${what} of ` : ''}
          <Text style={{ fontWeight: '700' }}>{e.title}</Text>
          {e.year && !what ? ` (${e.year})` : ''}
        </Text>
        <View style={styles.feedMeta}>
          {rating ? <Stars rating={rating} size={12} color={theme.star} /> : null}
          {e.liked && <Ionicons name="heart" size={12} color={theme.like} />}
          <Text style={[styles.hint, { color: theme.textMuted }]}>{friendlyDate(e.watchedOn)}</Text>
          {!!e.review && <Ionicons name="chatbubble-outline" size={12} color={theme.textMuted} accessibilityLabel="Has a review" />}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 28, letterSpacing: 1, textAlign: 'center' },
  emptyText: { fontFamily: fonts.mono, fontSize: font.footnote, lineHeight: 19, textAlign: 'center' },
  content: { padding: 16, gap: 24 },
  codeCard: { borderWidth: 1.5, borderRadius: 16, padding: 18, gap: 8, alignItems: 'center' },
  codeLabel: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 2 },
  code: { fontFamily: fonts.display, fontSize: 52, letterSpacing: 4, lineHeight: 56 },
  hint: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17 },
  codeButtons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 6 },
  grow: { flex: 1 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23, paddingHorizontal: 22 },
  primaryText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1.5 },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, borderRadius: 23, borderWidth: 1, paddingHorizontal: 16 },
  secondaryText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  block: { gap: 10 },
  addRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, minWidth: 0, height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 2 },
  addBtn: { width: 76, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  feedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  feedText: { fontSize: font.footnote, lineHeight: 19 },
  feedMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
