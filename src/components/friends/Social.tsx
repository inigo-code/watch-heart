import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ActionSheet';
import { Text, TextInput } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Face } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { photoUrl } from '@/friends/friendsApi';
import { entryLikers, socialKey } from '@/friends/socialApi';
import type { Liker, Social } from '@/friends/socialApi';
import { friendEntryCache, postComment, removeComment, useMyId, useSocial, useThread } from '@/friends/useSocial';
import type { ShownComment } from '@/friends/useSocial';
import { shownError } from '@/lib/errors';
import { useHaptic } from '@/lib/haptics';
import { shortAgo } from '@/lib/socialNews';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import type { Entry } from '@/store/types';

// Likes and comments on a diary entry: the heart and comment count, the conversation under the review, the box
// to write in, and who liked yours.

const MOST = 1000;

/** Opens a friend's entry, showing at once what the list already had; `write` opens the comment box too. */
export function openFriendEntry(e: Entry & { userId: string }, write = false) {
  friendEntryCache.set(socialKey(e.userId, e.id), e);
  router.push({ pathname: '/friend-entry/[id]', params: { id: e.id, owner: e.userId, ...(write ? { write: '1' } : {}) } });
}

function openEntryToWrite(ownerId: string, entryId: string) {
  router.push({ pathname: '/friend-entry/[id]', params: { id: entryId, owner: ownerId, write: '1' } });
}

const NONE: { ownerId: string; entryId: string }[] = [];

/** Like and comment counts as small marks, for a row in a list (the screen fetches them with useSocial). */
export function SocialMarks({ ownerId, entryId, theme }: { ownerId: string; entryId: string; theme: Theme }) {
  const { get } = useSocial(NONE);
  const s = get(ownerId, entryId);
  if (!s || (!s.likes && !s.comments)) return null;
  return (
    <View style={styles.marks} accessibilityLabel={`${s.likes} likes, ${s.comments} comments`}>
      {s.likes > 0 && (
        <>
          <Ionicons name={s.liked ? 'heart' : 'heart-outline'} size={12} color={s.liked ? theme.like : theme.textMuted} />
          <Text style={[styles.markText, { color: theme.textMuted }]}>{s.likes}</Text>
        </>
      )}
      {s.comments > 0 && (
        <>
          <Ionicons name="chatbubble-outline" size={11} color={theme.textMuted} />
          <Text style={[styles.markText, { color: theme.textMuted }]}>{s.comments}</Text>
        </>
      )}
    </View>
  );
}

/** A link for each photo path (signed, kept on the phone a week); people without one get initials. */
export function usePhotoLinks(paths: (string | null)[]) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const wanted = [...new Set(paths.filter((p): p is string => !!p))].sort().join('|');
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    Promise.all(wanted.split('|').map(async (p) => [p, await photoUrl(p).catch(() => null)] as const)).then((got) => {
      if (!live) return;
      const next: Record<string, string> = {};
      for (const [p, url] of got) if (url) next[p] = url;
      setLinks(next);
    });
    return () => {
      live = false;
    };
  }, [wanted]);
  return links;
}

/**
 * The heart and the comment count, under an entry. On your own entry the heart is a count you can't press.
 * Comment opens the box (`onComment`), or on a card the friend's entry with the box open. Hidden until the
 * server has likes and comments.
 */
export function SocialBar({
  ownerId,
  entryId,
  theme,
  mine,
  compact,
  batched,
  onComment,
}: {
  ownerId: string;
  entryId: string;
  theme: Theme;
  mine?: boolean;
  compact?: boolean;
  /** The screen fetched counts for all its entries at once (useSocial), so this doesn't ask again. */
  batched?: boolean;
  onComment?: () => void;
}) {
  const [items] = useState(() => (batched ? NONE : [{ ownerId, entryId }]));
  const { get, toggleLike, ready } = useSocial(items);
  const toast = useToast();
  const haptic = useHaptic();
  const s: Social | undefined = get(ownerId, entryId);
  if (!ready && !s) return null;
  const likes = s?.likes ?? 0;
  const comments = s?.comments ?? 0;
  const size = compact ? 15 : 19;

  const like = () => {
    haptic('tick');
    toggleLike(ownerId, entryId).catch((e: unknown) => toast(shownError(e, 'Couldn’t save your like.')));
  };

  return (
    <View style={styles.bar}>
      {mine ? (
        <View style={styles.barItem} accessibilityLabel={likes === 1 ? '1 like' : `${likes} likes`}>
          <Ionicons name={likes ? 'heart' : 'heart-outline'} size={size} color={likes ? theme.like : theme.textMuted} />
          <Text style={[styles.barText, compact && styles.barSmall, { color: theme.textMuted }]}>{likes ? (likes === 1 ? '1 like' : `${likes} likes`) : 'No likes yet'}</Text>
        </View>
      ) : (
        <Pressable
          onPress={like}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ selected: !!s?.liked }}
          accessibilityLabel={`${s?.liked ? 'Liked' : 'Like'}${likes ? `, ${likes} ${likes === 1 ? 'like' : 'likes'}` : ''}`}
          style={({ pressed }) => [styles.barItem, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name={s?.liked ? 'heart' : 'heart-outline'} size={size} color={s?.liked ? theme.like : theme.textMuted} />
          <Text style={[styles.barText, compact && styles.barSmall, { color: s?.liked ? theme.like : theme.textMuted }]}>{likes ? String(likes) : 'Like'}</Text>
        </Pressable>
      )}
      <Pressable
        onPress={onComment ?? (() => openEntryToWrite(ownerId, entryId))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={mine ? 'Reply' : 'Write a comment'}
        style={({ pressed }) => [styles.barItem, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chatbubble-outline" size={size - 1} color={theme.textMuted} />
        <Text style={[styles.barText, compact && styles.barSmall, { color: theme.textMuted }]}>{comments ? String(comments) : mine ? 'Reply' : 'Comment'}</Text>
      </Pressable>
    </View>
  );
}

/** One comment: face, name, when, and the words. Yours shows "Sending" until the server has it. */
export function CommentRow({ c, photo, theme, isOwner, onLongPress }: { c: ShownComment; photo: string | null; theme: Theme; isOwner: boolean; onLongPress?: () => void }) {
  return (
    <Pressable onLongPress={c.pending ? undefined : onLongPress} delayLongPress={350} style={[styles.comment, c.pending && { opacity: 0.6 }]} accessibilityHint={onLongPress ? 'Hold for options' : undefined}>
      <Face uri={photo} name={c.name} theme={theme} size={32} round />
      <View style={styles.commentBody}>
        <View style={styles.commentHead}>
          <Text style={[styles.commentName, { color: theme.text }]} numberOfLines={1}>
            {c.name}
          </Text>
          {isOwner && <Text style={[styles.badge, { color: theme.textMuted, borderColor: theme.border }]}>Logged it</Text>}
          <Text style={[styles.when, { color: theme.textMuted }]}>{c.pending ? 'Sending…' : shortAgo(c.at)}</Text>
        </View>
        <Text style={[styles.commentText, { color: theme.text }]} selectable>
          {c.body}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The conversation on an entry, under its review. With `limit`, a card shows only the latest few and a link to
 * the rest. Hold a comment to delete it (yours anywhere, any on your own entry).
 */
export function CommentList({ ownerId, entryId, theme, limit }: { ownerId: string; entryId: string; theme: Theme; limit?: number }) {
  const { get } = useSocial(NONE);
  const count = get(ownerId, entryId)?.comments ?? 0;
  // A card asks only when there's something to show; an entry page always does.
  const { thread } = useThread(ownerId, entryId, limit ? count > 0 : true);
  const me = useMyId(true);
  const toast = useToast();
  const [options, setOptions] = useState<ShownComment | null>(null);
  const links = usePhotoLinks((thread ?? []).map((c) => c.photoPath));
  if (!thread?.length) return null;
  const shown = limit ? thread.slice(-limit) : thread;
  const mineEntry = !!me && me === ownerId;

  const remove = (c: ShownComment) =>
    removeComment(ownerId, entryId, c)
      .then(() => toast('Comment deleted'))
      .catch((e: unknown) => toast(shownError(e, 'Couldn’t delete that comment.')));

  return (
    <View style={styles.list}>
      {shown.map((c) => (
        <CommentRow
          key={c.id}
          c={c}
          photo={c.photoPath ? (links[c.photoPath] ?? null) : null}
          theme={theme}
          isOwner={c.authorId === ownerId}
          onLongPress={c.authorId === me || mineEntry ? () => setOptions(c) : undefined}
        />
      ))}
      {!!limit && thread.length > shown.length && (
        <Pressable onPress={() => router.push({ pathname: '/friend-entry/[id]', params: { id: entryId, owner: ownerId } })} accessibilityRole="button" style={styles.all} hitSlop={6}>
          <Text style={[styles.allText, { color: theme.accent }]}>See all {thread.length} comments</Text>
        </Pressable>
      )}
      <ActionSheet
        visible={!!options}
        title={options ? `Delete ${options.authorId === me ? 'your comment' : `${options.name}’s comment`}? This can’t be undone.` : ''}
        actions={options ? [{ label: 'Delete comment', icon: 'trash-outline', destructive: true, onPress: () => remove(options) }] : []}
        onClose={() => setOptions(null)}
      />
    </View>
  );
}

/**
 * Under an entry's review: every comment, then a line to write your own. The box rises over the keyboard;
 * a comment shows the moment you send it. `writing` opens the box from outside (the Comment button).
 */
export function Conversation({
  ownerId,
  entryId,
  theme,
  mine,
  ownerName,
  writing,
  onWriting,
}: {
  ownerId: string;
  entryId: string;
  theme: Theme;
  mine?: boolean;
  ownerName: string;
  writing: boolean;
  onWriting: (open: boolean) => void;
}) {
  const { settings } = useSettings();
  const me = useMyId(true);
  const toast = useToast();
  const haptic = useHaptic();
  const insets = useSafeAreaInsets();
  const [words, setWords] = useState('');
  const myPhoto = usePhotoLinks([settings.photoPath])[settings.photoPath ?? ''] ?? null;
  const prompt = mine ? 'Reply to your friends…' : 'Add a comment…';

  const send = () => {
    const clean = words.trim();
    if (!clean || !me) return;
    haptic('tick');
    setWords('');
    onWriting(false);
    postComment(ownerId, entryId, clean, { id: me, name: settings.name, photoPath: settings.photoPath }).catch((e: unknown) => {
      // Taken back: the words return to the box, ready to try again.
      setWords(clean);
      toast(shownError(e, 'Couldn’t post your comment.'));
    });
  };

  return (
    <View style={styles.conversation}>
      <CommentList ownerId={ownerId} entryId={entryId} theme={theme} />
      <Pressable
        onPress={() => onWriting(true)}
        accessibilityRole="button"
        accessibilityLabel={mine ? 'Write a reply' : 'Write a comment'}
        style={({ pressed }) => [styles.writeRow, { borderColor: theme.border, backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}
      >
        <Face uri={myPhoto} name={settings.name || 'You'} theme={theme} size={28} round />
        <Text style={[styles.writeText, { color: words ? theme.text : theme.textMuted }]} numberOfLines={1}>
          {words || prompt}
        </Text>
      </Pressable>
      <BottomSheet visible={writing} onClose={() => onWriting(false)}>
        <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border, paddingBottom: insets.bottom + 16 }]}>
          <Text style={[styles.sheetTitle, { color: theme.textMuted }]}>{mine ? 'Reply to your friends' : `Comment on ${ownerName}’s entry`}</Text>
          <View style={styles.sheetRow}>
            <TextInput
              value={words}
              onChangeText={setWords}
              placeholder={prompt}
              placeholderTextColor={theme.textMuted}
              multiline
              autoFocus
              maxLength={MOST}
              accessibilityLabel={mine ? 'Your reply' : 'Your comment'}
              style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
            />
            <Pressable
              onPress={send}
              disabled={!words.trim() || !me}
              accessibilityRole="button"
              accessibilityLabel={mine ? 'Send reply' : 'Send comment'}
              style={[styles.send, { backgroundColor: words.trim() ? theme.accent : theme.chip }]}
            >
              {me ? <Ionicons name="arrow-up" size={20} color={words.trim() ? theme.accentText : theme.textMuted} /> : <ActivityIndicator color={theme.textMuted} />}
            </Pressable>
          </View>
          {words.length > MOST - 150 && <Text style={[styles.left, { color: theme.textMuted }]}>{MOST - words.length} characters left</Text>}
        </View>
      </BottomSheet>
    </View>
  );
}

/** On your own entry: the friends who liked it. */
export function LikedBy({ ownerId, entryId, theme }: { ownerId: string; entryId: string; theme: Theme }) {
  const [items] = useState(() => [{ ownerId, entryId }]);
  const { get } = useSocial(items);
  const likes = get(ownerId, entryId)?.likes ?? 0;
  const [people, setPeople] = useState<Liker[]>([]);
  const [open, setOpen] = useState(false);
  const links = usePhotoLinks(people.map((p) => p.photoPath));

  useEffect(() => {
    if (!likes) return;
    let live = true;
    entryLikers(ownerId, entryId)
      .then((p) => live && setPeople(p))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [ownerId, entryId, likes]);

  if (!likes || !people.length) return null;
  const names = people.map((p) => p.name);
  const line = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} and ${names.length - 1} others`;
  return (
    <View style={styles.liked}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.likedRow}>
        <View style={styles.faces}>
          {people.slice(0, 3).map((p, i) => (
            <View key={p.id} style={[styles.faceRing, { borderColor: theme.bg, marginLeft: i ? -10 : 0 }]}>
              <Face uri={p.photoPath ? (links[p.photoPath] ?? null) : null} name={p.name} theme={theme} size={24} round />
            </View>
          ))}
        </View>
        <Text style={[styles.likedText, { color: theme.textMuted }]} numberOfLines={1}>
          Liked by <Text style={{ color: theme.text, fontFamily: fonts.uiSemibold }}>{line}</Text>
        </Text>
      </Pressable>
      {open &&
        people.map((p) => (
          <View key={p.id} style={styles.likerRow}>
            <Face uri={p.photoPath ? (links[p.photoPath] ?? null) : null} name={p.name} theme={theme} size={28} round />
            <Text style={[styles.commentName, { color: theme.text, flex: 1 }]}>{p.name}</Text>
            <Text style={[styles.when, { color: theme.textMuted }]}>{shortAgo(p.at)}</Text>
          </View>
        ))}
    </View>
  );
}

export { socialKey };

const styles = StyleSheet.create({
  marks: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  markText: { fontFamily: fonts.uiSemibold, fontSize: 12, marginRight: 4 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  barItem: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  barText: { fontFamily: fonts.uiSemibold, fontSize: font.footnote },
  barSmall: { fontSize: font.caption },
  list: { gap: 14 },
  comment: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  commentBody: { flex: 1, gap: 2 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentName: { fontFamily: fonts.uiSemibold, fontSize: font.footnote, flexShrink: 1 },
  badge: { fontFamily: fonts.uiSemibold, fontSize: 11, borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, overflow: 'hidden' },
  when: { fontFamily: fonts.ui, fontSize: font.caption, marginLeft: 'auto' },
  commentText: { fontFamily: fonts.ui, fontSize: font.body, lineHeight: 21 },
  all: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  allText: { fontFamily: fonts.uiSemibold, fontSize: font.footnote },
  conversation: { gap: 16 },
  writeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderWidth: 1, borderRadius: 24, paddingLeft: 8, paddingRight: 16 },
  writeText: { flex: 1, fontFamily: fonts.ui, fontSize: font.body },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, padding: 16, gap: 10 },
  sheetTitle: { fontFamily: fonts.uiSemibold, fontSize: font.footnote },
  sheetRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: { flex: 1, minHeight: 44, maxHeight: 160, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontFamily: fonts.ui, fontSize: font.body },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  left: { fontFamily: fonts.ui, fontSize: font.caption, textAlign: 'right' },
  liked: { gap: 10 },
  likedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  faces: { flexDirection: 'row' },
  faceRing: { borderWidth: 2, borderRadius: 14 },
  likedText: { fontFamily: fonts.ui, fontSize: font.footnote, flex: 1 },
  likerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
