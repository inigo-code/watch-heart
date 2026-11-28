import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ActionSheet';
import { useConfirm } from '@/components/Confirm';
import { Text, TextInput } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Face } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { photoUrl } from '@/friends/friendsApi';
import { entryLikers, socialKey } from '@/friends/socialApi';
import type { Liker, Reaction, Social } from '@/friends/socialApi';
import { friendEntryCache, postComment, reactToComment, reactToEntry, removeComment, useMyId, useSocial, useThread } from '@/friends/useSocial';
import type { ShownComment } from '@/friends/useSocial';
import { shownError } from '@/lib/errors';
import { useHaptic } from '@/lib/haptics';
import { COMMENT_REACTIONS, entryReactions, hasOtherReactions, LIKE, myReaction } from '@/lib/reactions';
import { shortAgo } from '@/lib/socialNews';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import type { Entry } from '@/store/types';

// Likes and comments on a diary entry: the heart and comment count, the conversation under the review, the box
// to write in, and who liked yours. Holding the heart picks an emoji instead (a plain like is the heart).

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
          {hasOtherReactions(entryReactions(s)) ? (
            <Text style={styles.markEmoji}>{entryReactions(s).slice(0, 2).map((r) => r.emoji).join('')}</Text>
          ) : (
            <Ionicons name={s.liked ? 'heart' : 'heart-outline'} size={12} color={s.liked ? theme.like : theme.textMuted} />
          )}
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
  const { get, ready } = useSocial(items);
  const toast = useToast();
  const haptic = useHaptic();
  const [picking, setPicking] = useState(false);
  const s: Social | undefined = get(ownerId, entryId);
  if (!ready && !s) return null;
  const likes = s?.likes ?? 0;
  const comments = s?.comments ?? 0;
  const size = compact ? 15 : 19;
  const list = entryReactions(s);
  const yours = myReaction(list);
  // The emoji show only when there's more than hearts on it.
  const faces = hasOtherReactions(list) ? list.slice(0, 3) : [];

  const react = (emoji?: string) => {
    haptic('tick');
    reactToEntry(ownerId, entryId, emoji).catch((e: unknown) => toast(shownError(e, 'Couldn’t save your like.')));
  };
  const pick = () => {
    haptic('tick');
    setPicking(true);
  };
  const facesView = faces.length > 0 && (
    <View style={styles.faceRow} accessibilityLabel={faces.map((r) => `${r.emoji} ${r.count}`).join(', ')}>
      {faces.map((r, i) => (
        <View key={r.emoji} style={[styles.faceBubble, { backgroundColor: theme.chip, borderColor: theme.bg, marginLeft: i ? -6 : 0, zIndex: 3 - i }]}>
          <Text style={[styles.faceEmoji, compact && styles.faceEmojiSmall]}>{r.emoji}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.bar}>
      {mine ? (
        <View style={styles.barItem} accessibilityLabel={likes === 1 ? '1 like' : `${likes} likes`}>
          {facesView || <Ionicons name={likes ? 'heart' : 'heart-outline'} size={size} color={likes ? theme.like : theme.textMuted} />}
          <Text style={[styles.barText, compact && styles.barSmall, { color: theme.textMuted }]}>{likes ? (likes === 1 ? '1 like' : `${likes} likes`) : 'No likes yet'}</Text>
        </View>
      ) : (
        <View style={styles.likeGroup}>
          <Pressable
            onPress={() => react()}
            onLongPress={pick}
            delayLongPress={300}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ selected: !!yours }}
            accessibilityLabel={`${yours && yours !== LIKE ? `You reacted ${yours}` : yours ? 'Liked' : 'Like'}${likes ? `, ${likes} ${likes === 1 ? 'like' : 'likes'}` : ''}`}
            accessibilityHint="Hold to pick a reaction"
            accessibilityActions={[{ name: 'longpress', label: 'Pick a reaction' }]}
            onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && pick()}
            style={({ pressed }) => [styles.barItem, pressed && { opacity: 0.6 }]}
          >
            {yours && yours !== LIKE ? (
              <Text style={[styles.yourEmoji, { fontSize: size, lineHeight: size + 5 }]}>{yours}</Text>
            ) : (
              <Ionicons name={yours ? 'heart' : 'heart-outline'} size={size} color={yours ? theme.like : theme.textMuted} />
            )}
            <Text style={[styles.barText, compact && styles.barSmall, { color: yours ? theme.like : theme.textMuted }]}>{likes ? String(likes) : 'Like'}</Text>
          </Pressable>
          {facesView}
        </View>
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
      {!mine && (
        <ActionSheet
          visible={picking}
          title="React to this entry"
          emojis={{ options: COMMENT_REACTIONS, current: yours, onPick: (e) => react(e) }}
          actions={[]}
          onClose={() => setPicking(false)}
        />
      )}
    </View>
  );
}

/**
 * One comment: face, name, when, the words, and its reactions. Yours shows "Sending" until the server has it.
 * `onReact` (someone else's comment) makes each reaction a button: yours comes off, another moves yours there.
 */
export function CommentRow({
  c,
  photo,
  theme,
  isOwner,
  onLongPress,
  reactions,
  onReact,
}: {
  c: ShownComment;
  photo: string | null;
  theme: Theme;
  isOwner: boolean;
  onLongPress?: () => void;
  reactions?: Reaction[];
  onReact?: (emoji: string) => void;
}) {
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
        {!!reactions?.length && (
          <View style={styles.reactions}>
            {reactions.map((r) => {
              const label = `${r.emoji} ${r.count}${r.mine ? ', yours' : ''}`;
              const look = [styles.reaction, { backgroundColor: r.mine ? theme.accentSoft : theme.chip, borderColor: r.mine ? theme.accent : 'transparent' }];
              const inner = (
                <>
                  <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                  <Text style={[styles.reactionCount, { color: r.mine ? theme.text : theme.textMuted }]}>{r.count}</Text>
                </>
              );
              return onReact ? (
                <Pressable
                  key={r.emoji}
                  onPress={() => onReact(r.emoji)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityState={{ selected: r.mine }}
                  accessibilityLabel={r.mine ? `${label}. Tap to take it off` : `${label}. Tap to react ${r.emoji}`}
                  style={({ pressed }) => [look, pressed && { opacity: 0.6 }]}
                >
                  {inner}
                </Pressable>
              ) : (
                <View key={r.emoji} style={look} accessibilityLabel={label}>
                  {inner}
                </View>
              );
            })}
          </View>
        )}
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
  const { thread, reactions } = useThread(ownerId, entryId, limit ? count > 0 : true);
  const me = useMyId(true);
  const toast = useToast();
  const haptic = useHaptic();
  const confirm = useConfirm();
  const [options, setOptions] = useState<ShownComment | null>(null);
  const links = usePhotoLinks((thread ?? []).map((c) => c.photoPath));
  if (!thread?.length) return null;
  const shown = limit ? thread.slice(-limit) : thread;
  const mineEntry = !!me && me === ownerId;

  const remove = (c: ShownComment) =>
    removeComment(ownerId, entryId, c)
      .then(() => toast('Comment deleted'))
      .catch((e: unknown) => toast(shownError(e, 'Couldn’t delete that comment.')));
  const react = (c: ShownComment, emoji: string) => {
    haptic('tick');
    reactToComment(ownerId, entryId, c.id, emoji).catch((e: unknown) => toast(shownError(e, 'Couldn’t save your reaction.')));
  };
  // Someone else's comment: react to it (and, on your entry, delete it after asking). Your own: delete it.
  const theirs = !!options && !!me && options.authorId !== me;
  const deleteAsk = (c: ShownComment) => `Delete ${c.authorId === me ? 'your comment' : `${c.name}’s comment`}? This can’t be undone.`;

  return (
    <View style={styles.list}>
      {shown.map((c) => (
        <CommentRow
          key={c.id}
          c={c}
          photo={c.photoPath ? (links[c.photoPath] ?? null) : null}
          theme={theme}
          isOwner={c.authorId === ownerId}
          onLongPress={me ? () => setOptions(c) : undefined}
          reactions={reactions[c.id]}
          onReact={me && c.authorId !== me && !c.pending ? (emoji) => react(c, emoji) : undefined}
        />
      ))}
      {!!limit && thread.length > shown.length && (
        <Pressable onPress={() => router.push({ pathname: '/friend-entry/[id]', params: { id: entryId, owner: ownerId } })} accessibilityRole="button" style={styles.all} hitSlop={6}>
          <Text style={[styles.allText, { color: theme.accent }]}>See all {thread.length} comments</Text>
        </Pressable>
      )}
      <ActionSheet
        visible={!!options}
        title={options ? (theirs ? `React to ${options.name}’s comment` : deleteAsk(options)) : ''}
        emojis={options && theirs ? { options: COMMENT_REACTIONS, current: myReaction(reactions[options.id]), onPick: (e) => react(options, e) } : undefined}
        actions={
          !options
            ? []
            : !theirs
              ? [{ label: 'Delete comment', icon: 'trash-outline', destructive: true, onPress: () => remove(options) }]
              : mineEntry
                ? [{ label: 'Delete comment', icon: 'trash-outline', destructive: true, onPress: () => confirm({ title: deleteAsk(options), label: 'Delete comment', onConfirm: () => void remove(options) }) }]
                : []
        }
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
  const emoji = people.some((p) => p.emoji && p.emoji !== LIKE);
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
          {emoji ? 'Reactions from' : 'Liked by'} <Text style={{ color: theme.text, fontFamily: fonts.uiSemibold }}>{line}</Text>
        </Text>
      </Pressable>
      {open &&
        people.map((p) => (
          <View key={p.id} style={styles.likerRow}>
            <Face uri={p.photoPath ? (links[p.photoPath] ?? null) : null} name={p.name} theme={theme} size={28} round />
            <Text style={[styles.commentName, { color: theme.text, flex: 1 }]}>{p.name}</Text>
            {!!p.emoji && <Text style={styles.likerEmoji}>{p.emoji}</Text>}
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
  markEmoji: { fontSize: 11, lineHeight: 15 },
  likeGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  yourEmoji: { textAlign: 'center' },
  faceRow: { flexDirection: 'row', alignItems: 'center' },
  faceBubble: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  faceEmoji: { fontSize: 12, lineHeight: 16 },
  faceEmojiSmall: { fontSize: 11, lineHeight: 14 },
  likerEmoji: { fontSize: 16, lineHeight: 20 },
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
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28, paddingHorizontal: 9, borderRadius: 14, borderWidth: 1 },
  reactionEmoji: { fontSize: 14, lineHeight: 18 },
  reactionCount: { fontFamily: fonts.uiSemibold, fontSize: font.caption },
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
