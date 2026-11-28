import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { SectionLabel } from '@/components/SectionLabel';
import { Face } from '@/components/title/Rows';
import { useFriends } from '@/friends/FriendsProvider';
import { rememberSocial } from '@/friends/socialAlerts';
import { myId, socialNews } from '@/friends/socialApi';
import type { SocialNews } from '@/lib/socialNews';
import { excerpt, newsRoute, shortAgo } from '@/lib/socialNews';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

const SHOWN = 8;

/** What it says in the list: who did what, on which title. */
function line(n: SocialNews) {
  const on = n.title ? ` on ${n.title}` : '';
  switch (n.kind) {
    case 'like':
      return { did: `${n.body ? ` reacted ${n.body} to` : ' liked'} your entry${n.title ? ` for ${n.title}` : ''}`, said: null };
    case 'comment':
      return { did: ` commented${on}`, said: n.body };
    case 'reply':
      return { did: ` replied${on}`, said: n.body };
    default:
      return { did: ` also commented${on}`, said: n.body };
  }
}

/**
 * Likes and comments on your entries, and replies after yours, from the last 30 days. Fetched again when
 * `round` changes (pull to refresh); what it shows counts as seen, so it isn't announced later.
 */
export function SocialActivity({ theme, round }: { theme: Theme; round: number }) {
  const { photos } = useFriends();
  const [news, setNews] = useState<SocialNews[]>([]);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    myId().then((v) => live && setMe(v));
    socialNews(null)
      .then((n) => {
        if (!live) return;
        setNews(n);
        rememberSocial(n);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [round]);

  if (!news.length) return null;
  return (
    <View style={styles.block}>
      <SectionLabel theme={theme}>Likes and comments</SectionLabel>
      {news.slice(0, SHOWN).map((n) => {
        const { did, said } = line(n);
        return (
          <Pressable
            key={n.id}
            onPress={() => router.push(newsRoute(n, me) as never)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, { borderBottomColor: theme.border, opacity: pressed ? 0.75 : 1 }]}
          >
            <Face uri={photos[n.whoId] ?? null} name={n.who} theme={theme} size={34} round />
            <View style={styles.text}>
              <Text style={[styles.what, { color: theme.text }]} numberOfLines={2}>
                <Text style={{ fontFamily: fonts.uiSemibold }}>{n.who}</Text>
                {did}
              </Text>
              {!!said && (
                <Text style={[styles.said, { color: theme.textMuted }]} numberOfLines={2}>
                  “{excerpt(said, 120)}”
                </Text>
              )}
            </View>
            <Text style={[styles.when, { color: theme.textMuted }]}>{shortAgo(n.at)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 2 },
  what: { fontFamily: fonts.ui, fontSize: font.footnote, lineHeight: 19 },
  said: { fontFamily: fonts.ui, fontSize: font.footnote, lineHeight: 19 },
  when: { fontFamily: fonts.ui, fontSize: font.caption },
});
