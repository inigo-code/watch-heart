import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Face } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { photoUrl } from '@/friends/friendsApi';
import { entryLikers, entryThread, socialKey } from '@/friends/socialApi';
import type { Comment, Liker, Social } from '@/friends/socialApi';
import { friendEntryCache, useSocial } from '@/friends/useSocial';
import { shownError } from '@/lib/errors';
import { useHaptic } from '@/lib/haptics';
import { shortAgo } from '@/lib/socialNews';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { Entry } from '@/store/types';

// Likes and comments on a diary entry: the bar under an entry, the last few comments, and who liked yours.

/** Opens a friend's entry, showing at once what the list already had. */
export function openFriendEntry(e: Entry & { userId: string }) {
  friendEntryCache.set(socialKey(e.userId, e.id), e);
  router.push({ pathname: '/friend-entry/[id]', params: { id: e.id, owner: e.userId } });
}

/** Opens the whole conversation, with the box to write in. */
export function openComments(ownerId: string, entryId: string, title: string, write = false) {
  router.push({ pathname: '/comments', params: { owner: ownerId, entry: entryId, title, ...(write ? { write: '1' } : {}) } });
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
          <Ionicons name={s.liked ? 'thumbs-up' : 'thumbs-up-outline'} size={12} color={s.liked ? theme.accent : theme.textMuted} />
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
 * Like and comment, under an entry. On your own entry the like is a count you can't press. Hidden until the
 * server has likes and comments.
 */
export function SocialBar({
  ownerId,
  entryId,
  title,
  theme,
  mine,
  compact,
  batched,
}: {
  ownerId: string;
  entryId: string;
  title: string;
  theme: Theme;
  mine?: boolean;
  compact?: boolean;
  /** The screen fetched counts for all its entries at once (useSocial), so this doesn't ask again. */
  batched?: boolean;
}) {
  const [items] = useState(() => (batched ? NONE : [{ ownerId, entryId }]));
  const { get, toggleLike, ready } = useSocial(items);
  const toast = useToast();
  const haptic = useHaptic();
  const s: Social | undefined = get(ownerId, entryId);
  if (!ready && !s) return null;
  const likes = s?.likes ?? 0;
  const comments = s?.comments ?? 0;
  const size = compact ? 15 : 18;

  const like = () => {
    haptic('tick');
    toggleLike(ownerId, entryId).catch((e: unknown) => toast(shownError(e, 'Couldn’t save your like.')));
  };

  return (
    <View style={styles.bar}>
      {mine ? (
        <View style={styles.barItem} accessibilityLabel={likes === 1 ? '1 like' : `${likes} likes`}>
          <Ionicons name="thumbs-up-outline" size={size} color={theme.textMuted} />
          <Text style={[styles.barText, compact && styles.barSmall, { color: theme.textMuted }]}>{likes ? String(likes) : 'No likes yet'}</Text>
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
          <Ionicons name={s?.liked ? 'thumbs-up' : 'thumbs-up-outline'} size={size} color={s?.liked ? theme.accent : theme.textMuted} />
          <Text style={[styles.barText, compact && styles.barSmall, { color: s?.liked ? theme.accent : theme.textMuted }]}>{likes ? String(likes) : 'Like'}</Text>
        </Pressable>
      )}
      <Pressable
        onPress={() => openComments(ownerId, entryId, title, comments === 0)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={comments ? `${comments} ${comments === 1 ? 'comment' : 'comments'}, open` : mine ? 'Comments' : 'Comment'}
        style={({ pressed }) => [styles.barItem, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chatbubble-outline" size={size - 1} color={theme.textMuted} />
        <Text style={[styles.barText, compact && styles.barSmall, { color: theme.textMuted }]}>{comments ? String(comments) : mine ? 'Comments' : 'Comment'}</Text>
      </Pressable>
    </View>
  );
}

/** One comment: face, name, when, and the words. */
export function CommentRow({ c, photo, theme, isOwner, onLongPress }: { c: Comment; photo: string | null; theme: Theme; isOwner: boolean; onLongPress?: () => void }) {
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={350} style={styles.comment} accessibilityHint={onLongPress ? 'Hold for options' : undefined}>
      <Face uri={photo} name={c.name} theme={theme} size={32} round />
      <View style={styles.commentBody}>
        <View style={styles.commentHead}>
          <Text style={[styles.commentName, { color: theme.text }]} numberOfLines={1}>
            {c.name}
          </Text>
          {isOwner && <Text style={[styles.badge, { color: theme.textMuted, borderColor: theme.border }]}>Logged it</Text>}
          <Text style={[styles.when, { color: theme.textMuted }]}>{shortAgo(c.at)}</Text>
        </View>
        <Text style={[styles.commentText, { color: theme.text }]} selectable>
          {c.body}
        </Text>
      </View>
    </Pressable>
  );
}

/** The last two comments and a link to all of them, under an entry. Nothing when there are none. */
export function CommentsPreview({ ownerId, entryId, title, theme }: { ownerId: string; entryId: string; title: string; theme: Theme }) {
  const [items] = useState(() => [{ ownerId, entryId }]);
  const { get } = useSocial(items);
  const count = get(ownerId, entryId)?.comments ?? 0;
  const [thread, setThread] = useState<Comment[] | null>(null);
  const links = usePhotoLinks((thread ?? []).map((c) => c.photoPath));

  useEffect(() => {
    if (!count) return;
    let live = true;
    entryThread(ownerId, entryId)
      .then((t) => live && setThread(t))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [ownerId, entryId, count]);

  if (!count || !thread?.length) return null;
  const last = thread.slice(-2);
  return (
    <View style={[styles.preview, { borderColor: theme.border }]}>
      {last.map((c) => (
        <CommentRow key={c.id} c={c} photo={c.photoPath ? (links[c.photoPath] ?? null) : null} theme={theme} isOwner={c.authorId === ownerId} />
      ))}
      <Pressable onPress={() => openComments(ownerId, entryId, title)} accessibilityRole="button" style={styles.all} hitSlop={6}>
        <Text style={[styles.allText, { color: theme.accent }]}>{thread.length > 2 ? `See all ${thread.length} comments` : 'Reply'}</Text>
      </Pressable>
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
  preview: { gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  comment: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  commentBody: { flex: 1, gap: 2 },
  commentHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentName: { fontFamily: fonts.uiSemibold, fontSize: font.footnote, flexShrink: 1 },
  badge: { fontFamily: fonts.uiSemibold, fontSize: 11, borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, overflow: 'hidden' },
  when: { fontFamily: fonts.ui, fontSize: font.caption, marginLeft: 'auto' },
  commentText: { fontFamily: fonts.ui, fontSize: font.body, lineHeight: 21 },
  all: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  allText: { fontFamily: fonts.uiSemibold, fontSize: font.footnote },
  liked: { gap: 10 },
  likedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  faces: { flexDirection: 'row' },
  faceRing: { borderWidth: 2, borderRadius: 14 },
  likedText: { fontFamily: fonts.ui, fontSize: font.footnote, flex: 1 },
  likerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
