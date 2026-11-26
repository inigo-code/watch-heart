import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { Text, TextInput } from '@/components/AppText';
import { CommentRow, usePhotoLinks } from '@/components/friends/Social';
import { KeyboardSafe } from '@/components/KeyboardSafe';
import { useToast } from '@/components/Toast';
import { useFriends } from '@/friends/FriendsProvider';
import { addComment, deleteComment, entryThread, myId, socialKey } from '@/friends/socialApi';
import type { Comment } from '@/friends/socialApi';
import { bumpComments } from '@/friends/useSocial';
import { shownError } from '@/lib/errors';
import { font, fonts, useTheme } from '@/lib/theme';

const MOST = 1000;

/** The conversation on a diary entry: everyone who can see the entry reads it; its owner's comments are replies. */
export default function CommentsScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { owner, entry, title, write } = useLocalSearchParams<{ owner: string; entry: string; title?: string; write?: string }>();
  const { byId } = useFriends();
  const [me, setMe] = useState<string | null>(null);
  const [thread, setThread] = useState<Comment[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [words, setWords] = useState('');
  const [sending, setSending] = useState(false);
  const [options, setOptions] = useState<Comment | null>(null);
  const list = useRef<FlatList<Comment>>(null);
  const links = usePhotoLinks((thread ?? []).map((c) => c.photoPath));
  const mine = !!me && me === owner;

  const load = useCallback(async () => {
    try {
      setThread(await entryThread(owner, entry));
      setFailed(null);
    } catch (e) {
      setFailed(shownError(e, 'Couldn’t load the comments.'));
    }
  }, [owner, entry]);

  useEffect(() => {
    let live = true;
    myId().then((v) => live && setMe(v));
    entryThread(owner, entry)
      .then((t) => live && setThread(t))
      .catch((e: unknown) => live && setFailed(shownError(e, 'Couldn’t load the comments.')));
    return () => {
      live = false;
    };
  }, [owner, entry]);

  const send = async () => {
    const clean = words.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      await addComment(owner, entry, clean);
      setWords('');
      bumpComments(socialKey(owner, entry), 1);
      await load();
      setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      toast(shownError(e, 'Couldn’t post your comment.'));
    } finally {
      setSending(false);
    }
  };

  const remove = async (c: Comment) => {
    setThread((t) => t?.filter((x) => x.id !== c.id) ?? t);
    try {
      await deleteComment(c.id);
      bumpComments(socialKey(owner, entry), -1);
      toast('Comment deleted');
    } catch (e) {
      toast(shownError(e, 'Couldn’t delete that comment.'));
      load();
    }
  };

  const whose = mine ? 'your' : `${byId(owner)?.name ?? 'your friend'}’s`;

  return (
    <KeyboardSafe>
      <FlatList
        ref={list}
        data={thread ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          title ? (
            <Text style={[styles.about, { color: theme.textMuted }]} numberOfLines={2}>
              On {whose} entry for <Text style={{ color: theme.text, fontFamily: fonts.uiSemibold }}>{title}</Text>
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          failed ? (
            <Pressable onPress={load} accessibilityRole="button" style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>{failed}</Text>
              <Text style={[styles.emptyText, { color: theme.accent }]}>Try again</Text>
            </Pressable>
          ) : thread === null ? (
            <ActivityIndicator color={theme.accent} style={styles.empty} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={36} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>{mine ? 'No comments yet. Friends who can see your diary can comment here.' : 'No comments yet. Say what you thought.'}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <CommentRow
            c={item}
            photo={item.photoPath ? (links[item.photoPath] ?? null) : null}
            theme={theme}
            isOwner={item.authorId === owner}
            onLongPress={item.authorId === me || mine ? () => setOptions(item) : undefined}
          />
        )}
        onContentSizeChange={() => write && list.current?.scrollToEnd({ animated: false })}
      />
      <View style={[styles.composer, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>
        <TextInput
          value={words}
          onChangeText={setWords}
          placeholder={mine ? 'Reply to your friends…' : 'Add a comment…'}
          placeholderTextColor={theme.textMuted}
          multiline
          maxLength={MOST}
          autoFocus={!!write}
          accessibilityLabel={mine ? 'Your reply' : 'Your comment'}
          style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
        />
        <Pressable
          onPress={send}
          disabled={!words.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel={mine ? 'Send reply' : 'Send comment'}
          style={[styles.send, { backgroundColor: words.trim() ? theme.accent : theme.chip }]}
        >
          {sending ? <ActivityIndicator color={theme.accentText} /> : <Ionicons name="arrow-up" size={20} color={words.trim() ? theme.accentText : theme.textMuted} />}
        </Pressable>
      </View>
      <ActionSheet
        visible={!!options}
        title={options ? (options.authorId === me ? 'Your comment' : `${options.name}’s comment`) : ''}
        actions={options ? [{ label: 'Delete comment', icon: 'trash-outline', destructive: true, onPress: () => remove(options) }] : []}
        onClose={() => setOptions(null)}
      />
    </KeyboardSafe>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 18, flexGrow: 1 },
  about: { fontFamily: fonts.ui, fontSize: font.footnote, marginBottom: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  emptyText: { fontFamily: fonts.ui, fontSize: font.footnote, lineHeight: 19, textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 132, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontFamily: fonts.ui, fontSize: font.body },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
