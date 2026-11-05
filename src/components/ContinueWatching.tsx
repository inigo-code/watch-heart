import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionSheet } from '@/components/ActionSheet';
import { Text } from '@/components/AppText';
import { Poster } from '@/components/Film';
import { Rise, Tap } from '@/components/Motion';
import { SectionLabel } from '@/components/SectionLabel';
import { useToast } from '@/components/Toast';
import { friendlyDate, today } from '@/lib/dates';
import { continueWatching, counts, nextUp } from '@/lib/tracking';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useTracker } from '@/lib/useTracker';
import { useDiary } from '@/store/DiaryStore';
import type { WatchItem } from '@/store/types';

/**
 * Shows you're tracking, grouped: Ongoing, Old friends, Coming back; and the ones you've finished or dropped,
 * each with a way to stop tracking it. Stays mounted while `hidden`, to keep air dates fresh in the background.
 */
export function ContinueWatching({ items, theme, hidden }: { items: WatchItem[]; theme: Theme; hidden?: boolean }) {
  const tracker = useTracker();
  const toast = useToast();
  const { removeFromWatchlist, importWatchlist } = useDiary();
  const [menu, setMenu] = useState<WatchItem | null>(null);
  const tracked = items.filter((w) => w.track);
  const groups = continueWatching(tracked, today());
  const finished = tracked.filter((w) => w.track!.status === 'completed' || w.track!.status === 'dropped');

  if (hidden || !tracked.length) return null;
  const open = (w: WatchItem) => router.push({ pathname: '/track', params: { id: w.id } });
  const stop = (w: WatchItem) => {
    removeFromWatchlist(w.id);
    toast(`Stopped tracking “${w.title}”`, { label: 'Undo', onPress: () => importWatchlist([w]) });
  };

  return (
    <View style={styles.wrap}>
      {(
        [
          ['ONGOING', groups.ongoing],
          ['OLD FRIENDS', groups.oldFriends],
          ['COMING BACK', groups.comingBack],
        ] as const
      ).map(([label, list]) =>
        list.length ? (
          <View key={label} style={styles.group}>
            <SectionLabel theme={theme}>{label}</SectionLabel>
            {list.map((w, n) => {
              const t = w.track!;
              const c = counts(t);
              const up = nextUp(t);
              return (
                <Rise key={w.id} order={n}>
                  <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Tap
                      onPress={() => open(w)}
                      onLongPress={() => setMenu(w)}
                      accessibilityRole="button"
                      accessibilityLabel={`${w.title}: episodes`}
                      accessibilityHint="Long press for more"
                      style={styles.open}
                    >
                      <Poster uri={w.posterUrl} title={w.title} width={58} theme={theme} radius={4} />
                      <View style={styles.cardBody}>
                        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                          {w.title}
                        </Text>
                        <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
                          {up
                            ? `Next: S${up.season} · E${up.number}`
                            : t.nextAir
                              ? `S${t.nextAir.season} · E${t.nextAir.number} · ${friendlyDate(t.nextAir.date)}`
                              : 'New episodes to come'}
                        </Text>
                        <View style={[styles.bar, { backgroundColor: theme.elevated }]}>
                          <View style={[styles.fill, { width: `${c.aired ? (c.seen / c.aired) * 100 : 0}%`, backgroundColor: theme.accent }]} />
                        </View>
                        <Text style={[styles.meta, { color: theme.textMuted }]}>{c.left ? `${c.left} to go` : 'All caught up'}</Text>
                      </View>
                    </Tap>
                    {up && (
                      <Tap
                        onPress={() => {
                          tracker.toggle(w, up.season, up.number);
                          toast(`${w.title}: S${up.season} · E${up.number} logged · today`);
                        }}
                        hitSlop={6}
                        scale={0.9}
                        accessibilityRole="button"
                        accessibilityLabel={`Mark S${up.season} E${up.number} of ${w.title} as watched`}
                        style={[styles.plus, { backgroundColor: theme.accent }]}
                      >
                        <Text style={[styles.plusText, { color: theme.accentText }]}>+1</Text>
                      </Tap>
                    )}
                  </View>
                </Rise>
              );
            })}
          </View>
        ) : null,
      )}
      {finished.length > 0 && (
        <View style={styles.group}>
          <SectionLabel theme={theme}>FINISHED AND DROPPED</SectionLabel>
          {finished.map((w) => (
            <View key={w.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Tap onPress={() => open(w)} onLongPress={() => setMenu(w)} accessibilityRole="button" accessibilityLabel={`${w.title}, ${w.track!.status}`} style={styles.open}>
                <Poster uri={w.posterUrl} title={w.title} width={40} theme={theme} radius={4} style={{ opacity: w.track!.status === 'dropped' ? 0.5 : 1 }} />
                <View style={styles.cardBody}>
                  <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                    {w.title}
                  </Text>
                  <Text style={[styles.meta, { color: theme.textMuted }]}>{w.track!.status === 'dropped' ? 'Dropped' : 'Finished'}</Text>
                </View>
              </Tap>
              <Pressable onPress={() => stop(w)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${w.title}`} style={styles.remove}>
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <ActionSheet
        visible={menu !== null}
        title={menu?.title}
        onClose={() => setMenu(null)}
        actions={
          menu
            ? [
                { label: 'Episodes', icon: 'list-outline', onPress: () => open(menu) },
                { label: 'Stop tracking', icon: 'close-circle-outline', destructive: true, onPress: () => stop(menu) },
              ]
            : []
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20, marginBottom: 6 },
  group: { gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardBody: { flex: 1, gap: 3 },
  title: { fontSize: font.footnote, fontWeight: '700' },
  meta: { fontFamily: fonts.mono, fontSize: font.caption },
  bar: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  fill: { height: '100%', borderRadius: 3 },
  plus: {
    height: 34,
    minWidth: 44,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  plusText: { fontFamily: fonts.monoBold, fontSize: font.footnote },
  remove: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
