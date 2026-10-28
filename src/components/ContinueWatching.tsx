import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Poster } from '@/components/Film';
import { SectionLabel } from '@/components/SectionLabel';
import { useToast } from '@/components/Toast';
import { friendlyDate, today } from '@/lib/dates';
import { continueWatching, counts, nextUp } from '@/lib/tracking';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useTracker } from '@/lib/useTracker';
import type { WatchItem } from '@/store/types';

const STALE = 12 * 60 * 60 * 1000;

/** Shows you're tracking, grouped: Ongoing, Old friends, Coming back; and the ones you've finished. */
export function ContinueWatching({ items, theme }: { items: WatchItem[]; theme: Theme }) {
  const tracker = useTracker();
  const toast = useToast();
  const tracked = items.filter((w) => w.track);
  const groups = continueWatching(tracked, today());
  const finished = tracked.filter((w) => w.track!.status === 'completed' || w.track!.status === 'dropped');

  // Air dates and new episodes, refreshed in the background (a few shows at a time).
  const refreshing = useRef(false);
  useEffect(() => {
    if (refreshing.current) return;
    const stale = tracked.filter((w) => w.track!.status !== 'dropped' && Date.now() - w.track!.checkedAt > STALE).slice(0, 6);
    if (!stale.length) return;
    refreshing.current = true;
    void Promise.all(stale.map((w) => tracker.refresh(w).catch(() => null))).finally(() => (refreshing.current = false));
  }, [tracked, tracker]);

  if (!tracked.length) return null;
  const open = (w: WatchItem) => router.push({ pathname: '/track', params: { id: w.id } });

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: theme.text }]}>
        CONTINUE <Text style={{ color: theme.accent }}>WATCHING</Text>
      </Text>
      {(
        [
          ['ONGOING', groups.ongoing],
          ['OLD FRIENDS', groups.oldFriends],
          ['COMING BACK', groups.comingBack],
        ] as const
      ).map(([label, list]) =>
        list.length ? (
          <View key={label} style={{ gap: 8 }}>
            <SectionLabel theme={theme}>{label}</SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
              {list.map((w) => {
                const t = w.track!;
                const c = counts(t);
                const up = nextUp(t);
                return (
                  <View
                    key={w.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => open(w)}
                      accessibilityRole="button"
                      accessibilityLabel={`${w.title}: episodes`}
                      style={({ pressed }) => [styles.open, { opacity: pressed ? 0.8 : 1 }]}
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
                          <View
                            style={[
                              styles.fill,
                              {
                                width: `${c.aired ? (c.seen / c.aired) * 100 : 0}%`,
                                backgroundColor: theme.accent,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.meta, { color: theme.textMuted }]}>{c.left ? `${c.left} to go` : 'All caught up'}</Text>
                      </View>
                    </Pressable>
                    {up && (
                      <Pressable
                        onPress={() => {
                          tracker.toggle(w, up.season, up.number);
                          toast(`${w.title}: S${up.season} · E${up.number} logged · today`);
                        }}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`Mark S${up.season} E${up.number} of ${w.title} as watched`}
                        style={[styles.plus, { backgroundColor: theme.accent }]}
                      >
                        <Text style={[styles.plusText, { color: theme.accentText }]}>+1</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null,
      )}
      {finished.length > 0 && (
        <View style={{ gap: 8 }}>
          <SectionLabel theme={theme}>FINISHED AND DROPPED</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
            {finished.map((w) => (
              <Pressable key={w.id} onPress={() => open(w)} accessibilityRole="button" accessibilityLabel={`${w.title}, ${w.track!.status}`}>
                <Poster uri={w.posterUrl} title={w.title} width={52} theme={theme} radius={4} style={{ opacity: w.track!.status === 'dropped' ? 0.5 : 1 }} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginBottom: 6 },
  heading: {
    fontFamily: fonts.display,
    fontSize: font.title2,
    letterSpacing: 1,
  },
  cards: { gap: 10 },
  card: {
    width: 282,
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
});
