import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { seasonEpisodes, showInfo } from '@/api/episodes';
import type { Episode, ShowInfo } from '@/api/episodes';
import { Chip, KindBadge, Poster } from '@/components/Film';
import { useToast } from '@/components/Toast';
import { friendlyDate, today } from '@/lib/dates';
import { counts, epKey, nextUp, withInfo } from '@/lib/tracking';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useTracker } from '@/lib/useTracker';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Title, TrackStatus, WatchItem } from '@/store/types';

type Params = { id?: string; title?: string };

const STATUSES: { key: TrackStatus; label: string }[] = [
  { key: 'watching', label: 'Watching' },
  { key: 'paused', label: 'On hold' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'completed', label: 'Completed' },
];

/** A series episode by episode: tick what you've seen, catch up a season at once, see what airs next. */
export default function TrackScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<Params>();
  const { settings } = useSettings();
  const { watchlist, onWatchlist } = useDiary();
  const tracker = useTracker();

  const title = useMemo(() => (params.title ? (JSON.parse(params.title) as Title) : null), [params.title]);
  const item = params.id ? watchlist.find((w) => w.id === params.id) : title ? onWatchlist(title) : undefined;
  const show: Title | WatchItem | undefined = item ?? title ?? undefined;

  const [info, setInfo] = useState<ShowInfo | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<{ season: number; list: Episode[] } | null>(null);

  // The show's seasons and air dates, fresh each time it's opened.
  const source = show?.source;
  const sourceId = show?.sourceId;
  useEffect(() => {
    if (!source || !sourceId) return;
    const controller = new AbortController();
    showInfo(settings.tmdbKey, source, sourceId, controller.signal)
      .then((i) => {
        if (controller.signal.aborted) return;
        setInfo(i);
        setFailed(null);
      })
      .catch((e) => !controller.signal.aborted && setFailed(e instanceof Error ? e.message : String(e)));
    return () => controller.abort();
  }, [settings.tmdbKey, source, sourceId]);

  // Store fresh details on a tracked show (once per opening).
  const stored = useRef(false);
  useEffect(() => {
    if (!info || !item?.track || stored.current) return;
    stored.current = true;
    tracker.refresh(item).catch(() => {});
  }, [info, item, tracker]);

  const [openedAt] = useState(() => Date.now());
  const track = item?.track && info ? withInfo(item.track, info, openedAt) : item?.track;
  const up = track ? nextUp(track) : null;
  const current = season ?? up?.season ?? info?.seasons[0]?.n ?? null;

  useEffect(() => {
    if (!source || !sourceId || current === null) return;
    const controller = new AbortController();
    seasonEpisodes(settings.tmdbKey, source, sourceId, current, controller.signal)
      .then((list) => !controller.signal.aborted && setEpisodes({ season: current, list }))
      .catch(() => {});
    return () => controller.abort();
  }, [settings.tmdbKey, source, sourceId, current]);

  if (!show) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.note, { color: theme.textMuted }]}>This show isn’t on your list any more.</Text>
      </View>
    );
  }

  const c = track ? counts(track) : null;
  const todayIso = today();
  const list = episodes?.season === current ? episodes.list : null;
  const aired = (e: Episode) => !!e.airDate && e.airDate <= todayIso;
  const isSeen = (e: Episode) => !!track?.seen[epKey(e.season, e.number)];
  const seasonKeys = (list ?? []).filter(aired).map((e) => epKey(e.season, e.number));
  const seasonDone = seasonKeys.length > 0 && seasonKeys.every((k) => track?.seen[k]);

  const tick = (e: Episode) => {
    const was = isSeen(e);
    tracker.toggle(item ?? show, e.season, e.number, info ?? undefined);
    toast(was ? `Unticked S${e.season} · E${e.number}` : `S${e.season} · E${e.number} logged · today`);
  };
  const upToHere = (e: Episode) => {
    if (!info) return;
    const keys: string[] = [];
    for (const s of info.seasons) for (let n = 1; n <= s.count; n++) if (s.n < e.season || (s.n === e.season && n <= e.number)) keys.push(epKey(s.n, n));
    tracker.markMany(item ?? show, keys, true, info);
    toast(`Caught up to S${e.season} · E${e.number}`);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
      <Stack.Screen options={{ title: 'EPISODES' }} />
      <View style={styles.head}>
        <Poster uri={show.posterUrl} title={show.title} width={92} theme={theme} radius={6} />
        <View style={{ flex: 1, gap: 6 }}>
          <KindBadge kind={show.kind} theme={theme} small />
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={3}>
            {show.title.toUpperCase()}
          </Text>
          {c ? (
            <>
              <Text style={[styles.note, { color: theme.textMuted }]}>
                {c.seen} of {c.aired} aired episodes seen{c.total > c.aired ? ` · ${c.total} announced` : ''}
              </Text>
              <View style={[styles.track, { backgroundColor: theme.elevated }]}>
                <View style={[styles.fill, { width: `${c.aired ? (c.seen / c.aired) * 100 : 0}%`, backgroundColor: theme.accent }]} />
              </View>
            </>
          ) : (
            <Text style={[styles.note, { color: theme.textMuted }]}>Tick an episode to start tracking. It shows under Continue watching.</Text>
          )}
        </View>
      </View>

      {(up || track?.nextAir) && (
        <View style={[styles.next, { backgroundColor: theme.accentSoft, borderColor: theme.accent + '55' }]}>
          <Ionicons name={up ? 'play-circle' : 'calendar'} size={22} color={theme.accent} />
          <Text style={[styles.nextText, { color: theme.text }]}>
            {up ? `Up next: S${up.season} · E${up.number}` : `Caught up. S${track!.nextAir!.season} · E${track!.nextAir!.number} airs ${friendlyDate(track!.nextAir!.date)}`}
          </Text>
          {up && (
            <Pressable
              onPress={() => (setSeason(up.season), tracker.toggle(item ?? show, up.season, up.number, info ?? undefined), toast(`S${up.season} · E${up.number} logged · today`))}
              accessibilityRole="button"
              style={[styles.plus, { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.plusText, { color: theme.accentText }]}>+1</Text>
            </Pressable>
          )}
        </View>
      )}

      {item?.track && (
        <View style={styles.row}>
          {STATUSES.map((s) => (
            <Chip key={s.key} theme={theme} label={s.label} active={item.track!.status === s.key} onPress={() => tracker.setStatus(item, s.key, info ?? undefined)} />
          ))}
        </View>
      )}

      {failed && <Text style={[styles.note, { color: theme.danger }]}>{failed}</Text>}
      {!info && !failed && <ActivityIndicator color={theme.accent} style={{ marginTop: 20 }} />}

      {info && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {info.seasons.map((s) => (
              <SeasonChip key={s.n} theme={theme} label={`S${s.n}`} active={current === s.n} done={!!track && Array.from({ length: s.count }, (_, i) => epKey(s.n, i + 1)).every((k) => track.seen[k])} onPress={() => setSeason(s.n)} />
            ))}
          </ScrollView>

          {list && seasonKeys.length > 0 && (
            <Pressable
              onPress={() => {
                tracker.markMany(item ?? show, seasonKeys, !seasonDone, info);
                toast(seasonDone ? `Season ${current} unmarked` : `Season ${current} marked as seen`);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.seasonAll, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name={seasonDone ? 'close-circle-outline' : 'checkmark-done'} size={18} color={theme.accent} />
              <Text style={[styles.seasonAllText, { color: theme.text }]}>{seasonDone ? `UNMARK SEASON ${current}` : `MARK SEASON ${current} AS SEEN`}</Text>
            </Pressable>
          )}

          {!list ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <View style={{ gap: 8 }}>
              {list.map((e) => {
                const seen = isSeen(e);
                const out = aired(e);
                return (
                  <Pressable
                    key={e.number}
                    onPress={() => out && tick(e)}
                    onLongPress={() => out && upToHere(e)}
                    disabled={!out}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: seen, disabled: !out }}
                    style={({ pressed }) => [styles.episode, { backgroundColor: theme.card, borderColor: seen ? theme.accent + '66' : theme.border, opacity: !out ? 0.55 : pressed ? 0.8 : 1 }]}
                  >
                    <Text style={[styles.epNum, { color: seen ? theme.accent : theme.textMuted }]}>{e.number}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.epName, { color: theme.text }]} numberOfLines={2}>
                        {e.name || `Episode ${e.number}`}
                      </Text>
                      <Text style={[styles.epMeta, { color: theme.textMuted }]}>
                        {[e.airDate ? (out ? friendlyDate(e.airDate) : `Airs ${friendlyDate(e.airDate)}`) : 'Date not announced', e.runtime ? `${e.runtime} min` : null, seen && track?.seen[epKey(e.season, e.number)] ? `seen ${friendlyDate(track.seen[epKey(e.season, e.number)]).toLowerCase()}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Ionicons name={seen ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={seen ? theme.accent : theme.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          )}
          <Text style={[styles.note, { color: theme.textMuted }]}>Tap to tick an episode: it goes in today’s diary. Hold one to catch up to it (marks it and everything before as seen, without diary entries).</Text>
        </>
      )}
    </ScrollView>
  );
}

function SeasonChip({ theme, label, active, done, onPress }: { theme: Theme; label: string; active: boolean; done: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.seasonChip, { backgroundColor: active ? theme.chipActive : 'transparent', borderColor: active ? theme.chipActive : theme.border }]}
    >
      {done && <Ionicons name="checkmark" size={13} color={active ? theme.chipActiveText : theme.accent} />}
      <Text style={[styles.seasonChipText, { color: active ? theme.chipActiveText : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  head: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: font.largeTitle, lineHeight: 30, letterSpacing: 0.5 },
  note: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 16 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  nextText: { flex: 1, fontSize: font.body, fontWeight: '700' },
  plus: { height: 36, minWidth: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  plusText: { fontFamily: fonts.monoBold, fontSize: font.body },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seasonChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1 },
  seasonChipText: { fontFamily: fonts.monoBold, fontSize: font.footnote },
  seasonAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed' },
  seasonAllText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  episode: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  epNum: { fontFamily: fonts.display, fontSize: 26, width: 32, textAlign: 'center' },
  epName: { fontSize: font.body, fontWeight: '600' },
  epMeta: { fontFamily: fonts.mono, fontSize: font.caption, marginTop: 2 },
});
