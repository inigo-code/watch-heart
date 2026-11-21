import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/ActionSheet';
import { Text } from '@/components/AppText';
import { HeaderDisc } from '@/components/BackDisc';
import { dayWords, useDaySheet } from '@/components/DaySheet';
import { seasonEpisodes, showInfo } from '@/api/episodes';
import type { Episode, ShowInfo } from '@/api/episodes';
import { EpisodeSheet } from '@/components/EpisodeSheet';
import { Chip, KindBadge, Poster } from '@/components/Film';
import { SectionLabel } from '@/components/SectionLabel';
import { useToast } from '@/components/Toast';
import { daysAgo, friendlyDate, isoDate, parseIso, today } from '@/lib/dates';
import { UNKNOWN_DAY, airedKeys, counts, epKey, nextUp, seasonAired, withInfo } from '@/lib/tracking';
import type { Day } from '@/lib/tracking';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useTracker } from '@/lib/useTracker';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Title, TrackStatus, WatchItem } from '@/store/types';
import { shownError } from '@/lib/errors';

type Params = {
  id?: string;
  title?: string;
  season?: string;
  /** The day ticks are logged on: a YYYY-MM-DD day, or "unknown". Today when not given. */
  on?: string;
};

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
  const { watchlist, onWatchlist, removeFromWatchlist, importWatchlist } = useDiary();
  const tracker = useTracker();

  const title = useMemo(() => (params.title ? (JSON.parse(params.title) as Title) : null), [params.title]);
  const item = params.id ? watchlist.find((w) => w.id === params.id) : title ? onWatchlist(title) : undefined;
  const show: Title | WatchItem | undefined = item ?? title ?? undefined;

  const [info, setInfo] = useState<ShowInfo | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Opened from a season's poster: that season first.
  const [season, setSeason] = useState<number | null>(() => Number(params.season) || null);
  const [episodes, setEpisodes] = useState<{ season: number; list: Episode[] } | null>(null);
  // The episode in the sheet, by its number: the sheet shows it from the live list, so a refresh's new date shows there too.
  const [openedKey, setOpenedKey] = useState<{ season: number; number: number } | null>(null);
  // The day ticks here are logged on: today, unless you watched them another day or don't remember when.
  const [day, setDay] = useState<Day>(() =>
    params.on === 'unknown' ? { watchedOn: today(), undated: true } : params.on && /^\d{4}-\d{2}-\d{2}$/.test(params.on) ? { watchedOn: params.on } : { watchedOn: today() },
  );
  // Long presses ask for a day; the ⋯ menu holds the whole-show actions.
  const days = useDaySheet();
  const [menu, setMenu] = useState(false);
  const [clearing, setClearing] = useState(false);
  const dayChoice = day.undated ? 'unknown' : day.watchedOn === today() ? 'today' : day.watchedOn === daysAgo(1) ? 'yesterday' : 'other';
  const pickDay = () =>
    DateTimePickerAndroid.open({
      value: parseIso(day.watchedOn),
      mode: 'date',
      maximumDate: new Date(),
      onChange: (e, d) => e.type === 'set' && d && setDay({ watchedOn: isoDate(d) }),
    });

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
      .catch((e) => !controller.signal.aborted && setFailed(shownError(e, 'Something went wrong. Try again.')));
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
      <View style={styles.center}>
        <Text style={[styles.note, { color: theme.textMuted }]}>This show isn’t on your list any more.</Text>
      </View>
    );
  }

  const c = track ? counts(track) : null;
  const todayIso = today();
  // Air dates in your own time zone, when the exact time is known.
  const localDay = (e: Episode) => track?.upcoming?.find((u) => u.season === e.season && u.number === e.number)?.date ?? e.airDate;
  const list = episodes?.season === current ? episodes.list.map((e) => ({ ...e, airDate: localDay(e) })) : null;
  const aired = (e: Episode) => !!e.airDate && e.airDate <= todayIso;
  const isSeen = (e: Episode) => !!track?.seen[epKey(e.season, e.number)];
  const seasonKeys = (list ?? []).filter(aired).map((e) => epKey(e.season, e.number));
  const seasonDone = seasonKeys.length > 0 && seasonKeys.every((k) => track?.seen[k]);
  const opened = openedKey ? (list?.find((e) => e.season === openedKey.season && e.number === openedKey.number) ?? null) : null;

  const tick = (e: Episode) => {
    const was = isSeen(e);
    tracker.toggle(item ?? show, e.season, e.number, info ?? undefined, day);
    toast(was ? `Unticked S${e.season} · E${e.number}` : `S${e.season} · E${e.number} logged · ${dayWords(day)}`);
  };
  const rated = (e: Episode) => track?.ratings?.[epKey(e.season, e.number)] ?? 0;
  const upToHere = (e: Episode) => {
    if (!info) return;
    const keys: string[] = [];
    for (const s of info.seasons) for (let n = 1; n <= s.count; n++) if (s.n < e.season || (s.n === e.season && n <= e.number)) keys.push(epKey(s.n, n));
    tracker.markMany(item ?? show, keys, true, info, day);
    toast(`Caught up to S${e.season} · E${e.number}`);
  };

  const target = item ?? show;
  const aired_ = info ? { seasons: info.seasons, lastAired: info.lastAired } : null;
  const allAired = aired_ ? airedKeys(aired_) : [];
  const unseenAired = allAired.filter((k) => !track?.seen[k]);
  const seenKeys = Object.keys(track?.seen ?? {});
  const seenLine = (d: string) => (d === UNKNOWN_DAY ? 'Seen, date unknown' : `Seen ${friendlyDate(d)}`);

  /** Long press on an episode: the day you watched it (or move it to another day), catch up to it, or untick it. */
  const episodeMenu = (e: Episode) => {
    const key = epKey(e.season, e.number);
    const was = track?.seen[key];
    days.ask(
      {
        title: `S${e.season} · E${e.number}${e.name ? ` · ${e.name}` : ''}${was ? `\n${seenLine(was)}` : ''}`,
        verb: was ? 'Seen' : 'Watched',
        extra: [
          { label: 'Catch up to here (every episode before it too)', icon: 'play-skip-forward-outline', onPress: () => upToHere(e) },
          ...(was ? [{ label: 'Untick', icon: 'close-circle-outline' as const, destructive: true, onPress: () => tick(e) }] : []),
        ],
      },
      (d) => {
        tracker.logOn(target, [key], d, info ?? undefined);
        toast(`S${e.season} · E${e.number} logged · ${dayWords(d)}`);
      },
    );
  };

  /** Long press on a season: the whole season on one day (unseen ones ticked, seen ones moved), or unmark it. */
  const seasonMenu = (n: number) => {
    const keys = aired_ ? seasonAired(aired_, n) : [];
    if (!keys.length) return;
    const seenHere = keys.filter((k) => track?.seen[k]);
    days.ask(
      {
        title: `Season ${n} · ${seenHere.length} of ${keys.length} aired episodes seen`,
        extra: seenHere.length
          ? [{ label: `Unmark season ${n}`, icon: 'close-circle-outline', destructive: true, onPress: () => (tracker.logSeason(target, n, keys, false, info ?? undefined), toast(`Season ${n} unmarked`)) }]
          : [],
      },
      (d) => {
        tracker.logOn(target, keys, d, info ?? undefined);
        toast(`Season ${n} logged · ${dayWords(d)}`);
      },
    );
  };

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
      <Stack.Screen
        options={{
          title: 'Episodes',
          headerRight: () => (info ? <HeaderDisc icon="ellipsis-horizontal" label="More for the whole show" onPress={() => setMenu(true)} /> : null),
        }}
      />
      <View style={styles.head}>
        <Poster uri={show.posterUrl} title={show.title} width={92} theme={theme} radius={6} />
        <View style={{ flex: 1, gap: 6 }}>
          <KindBadge kind={show.kind} theme={theme} small />
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={3}>
            {show.title}
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
            <Text style={[styles.note, { color: theme.textMuted }]}>Tick an episode to start tracking</Text>
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
              onPress={() => (setSeason(up.season), tracker.toggle(item ?? show, up.season, up.number, info ?? undefined, day), toast(`S${up.season} · E${up.number} logged · ${dayWords(day)}`))}
              onLongPress={() =>
                days.ask({ title: `S${up.season} · E${up.number}` }, (d) => {
                  setSeason(up.season);
                  tracker.logOn(target, [epKey(up.season, up.number)], d, info ?? undefined);
                  toast(`S${up.season} · E${up.number} logged · ${dayWords(d)}`);
                })
              }
              accessibilityRole="button"
              accessibilityHint="Long press to choose the day"
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
          <Chip
            theme={theme}
            icon="close-circle-outline"
            label="Stop tracking"
            active={false}
            onPress={() => {
              const was = item;
              removeFromWatchlist(was.id);
              toast(`Stopped tracking “${was.title}”`, { label: 'Undo', onPress: () => importWatchlist([was]) });
              if (router.canGoBack()) router.back();
            }}
          />
        </View>
      )}

      {/* The same question, chips and words as the log form's "Watched on". */}
      <View style={styles.dayBox}>
        <SectionLabel theme={theme}>Watched on</SectionLabel>
        <View style={styles.row}>
          <Chip theme={theme} label="Today" active={dayChoice === 'today'} onPress={() => setDay({ watchedOn: today() })} />
          <Chip theme={theme} label="Yesterday" active={dayChoice === 'yesterday'} onPress={() => setDay({ watchedOn: daysAgo(1) })} />
          {Platform.OS === 'android' && (
            <Chip theme={theme} icon="calendar-outline" label={dayChoice === 'other' ? friendlyDate(day.watchedOn) : 'Pick a date'} active={dayChoice === 'other'} onPress={pickDay} />
          )}
          <Chip theme={theme} icon="help-circle-outline" label="Don’t remember" active={dayChoice === 'unknown'} onPress={() => setDay({ watchedOn: today(), undated: true })} />
        </View>
        <Text style={[styles.note, { color: theme.textMuted }]}>Ticks below are logged on this day. Hold an episode or a season to choose another.</Text>
      </View>

      {failed && <Text style={[styles.note, { color: theme.danger }]}>{failed}</Text>}
      {!info && !failed && <ActivityIndicator color={theme.accent} style={{ marginTop: 20 }} />}

      {info && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {info.seasons.map((s) => (
              <SeasonChip key={s.n} theme={theme} label={`S${s.n}`} active={current === s.n} done={!!track && Array.from({ length: s.count }, (_, i) => epKey(s.n, i + 1)).every((k) => track.seen[k])} onPress={() => setSeason(s.n)} onLongPress={() => seasonMenu(s.n)} />
            ))}
          </ScrollView>

          {list && seasonKeys.length > 0 && (
            <Pressable
              onPress={() => {
                if (current != null) tracker.logSeason(item ?? show, current, seasonKeys, !seasonDone, info, day);
                toast(seasonDone ? `Season ${current} unmarked` : `Season ${current} logged · ${dayWords(day)}`);
              }}
              onLongPress={() => current != null && seasonMenu(current)}
              accessibilityRole="button"
              accessibilityHint="Long press to choose the day"
              style={({ pressed }) => [styles.seasonAll, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name={seasonDone ? 'close-circle-outline' : 'checkmark-done'} size={18} color={theme.accent} />
              <Text style={[styles.seasonAllText, { color: theme.text }]}>{seasonDone ? `Unmark season ${current}` : `Mark season ${current} as seen`}</Text>
            </Pressable>
          )}

          {show && current != null && (
            <Pressable
              onPress={() => {
                const t: Title = { kind: show.kind, source: show.source, sourceId: show.sourceId, title: show.title, originalTitle: show.originalTitle ?? undefined, year: show.year, posterUrl: show.posterUrl, backdropUrl: show.backdropUrl, genres: show.genres, runtime: show.runtime, credit: show.credit };
                router.push({ pathname: '/log', params: { title: JSON.stringify(t), season: String(current) } });
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.seasonAll, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="star-outline" size={18} color={theme.accent} />
              <Text style={[styles.seasonAllText, { color: theme.text }]}>Rate & review season {current}</Text>
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
                    onPress={() => setOpenedKey({ season: e.season, number: e.number })}
                    onLongPress={() => out && episodeMenu(e)}
                    accessibilityRole="button"
                    accessibilityLabel={`Episode ${e.number}, ${e.name}`}
                    style={({ pressed }) => [styles.episode, { backgroundColor: theme.card, borderColor: seen ? theme.accent + '66' : theme.border, opacity: !out ? 0.55 : pressed ? 0.8 : 1 }]}
                  >
                    <Text style={[styles.epNum, { color: seen ? theme.accent : theme.textMuted }]}>{e.number}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.epName, { color: theme.text }]} numberOfLines={2}>
                        {e.name || `Episode ${e.number}`}
                      </Text>
                      <Text style={[styles.epMeta, { color: theme.textMuted }]}>
                        {[e.airDate ? (out ? friendlyDate(e.airDate) : `Airs ${friendlyDate(e.airDate)}`) : 'Date not announced', e.runtime ? `${e.runtime} min` : null, seen && track?.seen[epKey(e.season, e.number)] ? seenWords(track.seen[epKey(e.season, e.number)]) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    {!!rated(e) && (
                      <View style={styles.epRating}>
                        <Ionicons name="star" size={13} color={theme.star} />
                        <Text style={[styles.epMeta, styles.epRatingText, { color: theme.text }]}>{rated(e) / 2}</Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => out && tick(e)}
                      disabled={!out}
                      hitSlop={10}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Watched episode ${e.number}`}
                      accessibilityState={{ checked: seen, disabled: !out }}
                    >
                      <Ionicons name={seen ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={seen ? theme.accent : theme.textMuted} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          )}
          <Text style={[styles.note, { color: theme.textMuted }]}>Tap an episode for details. Hold it to choose the day you saw it, or to catch up to it.</Text>
        </>
      )}
      <EpisodeSheet
        episode={opened}
        theme={theme}
        seen={!!opened && isSeen(opened)}
        rating={opened ? rated(opened) : 0}
        onRate={(r) => opened && tracker.rateEpisode(item ?? show, epKey(opened.season, opened.number), r, info ?? undefined, day)}
        seenOn={opened ? (track?.seen[epKey(opened.season, opened.number)] ?? null) : null}
        onTick={() => {
          if (opened) tick(opened);
          setOpenedKey(null);
        }}
        onPickDay={() => {
          const e = opened;
          setOpenedKey(null);
          if (e) episodeMenu(e);
        }}
        onClose={() => setOpenedKey(null)}
      />
      {days.sheet}
      <ActionSheet
        visible={menu}
        title={show.title}
        onClose={() => setMenu(false)}
        actions={[
          ...(unseenAired.length
            ? [
                {
                  label: `Mark every aired episode as seen (${unseenAired.length} to go)…`,
                  icon: 'checkmark-done' as const,
                  onPress: () =>
                    days.ask({ title: `${unseenAired.length} episodes not ticked yet` }, (d) => {
                      tracker.logOn(target, unseenAired, d, info ?? undefined);
                      toast(`${unseenAired.length} episodes logged · ${dayWords(d)}`);
                    }),
                },
              ]
            : []),
          ...(seenKeys.length
            ? [
                {
                  label: `Change the day for every seen episode (${seenKeys.length})…`,
                  icon: 'calendar-outline' as const,
                  onPress: () =>
                    days.ask({ title: `All ${seenKeys.length} seen episodes`, verb: 'Seen' }, (d) => {
                      tracker.logOn(target, seenKeys, d, info ?? undefined);
                      toast(`${seenKeys.length} episodes now seen · ${dayWords(d)}`);
                    }),
                },
                { label: 'Unmark every episode', icon: 'close-circle-outline' as const, destructive: true, onPress: () => setClearing(true) },
              ]
            : []),
        ]}
      />
      <ActionSheet
        visible={clearing}
        title={`Unmark all ${seenKeys.length} episodes of ${show.title}? Diary entries made by ticking them go too. Viewings you rated or reviewed stay, without these episodes.`}
        onClose={() => setClearing(false)}
        actions={[
          {
            label: 'Unmark all',
            icon: 'close-circle-outline',
            destructive: true,
            onPress: () => {
              tracker.markMany(target, seenKeys, false, info ?? undefined);
              toast('Every episode unmarked');
            },
          },
        ]}
      />
    </ScrollView>
  );
}

/** "seen today", "seen mon 3 nov 2025", or just "seen" for a day you don't remember. */
const seenWords = (d: string) => (d === UNKNOWN_DAY ? 'seen' : `seen ${friendlyDate(d).toLowerCase()}`);

function SeasonChip({ theme, label, active, done, onPress, onLongPress }: { theme: Theme; label: string; active: boolean; done: boolean; onPress: () => void; onLongPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
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
  dayBox: { gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  head: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  title: { fontFamily: fonts.uiBold, fontSize: font.title2, lineHeight: 29 },
  note: { fontFamily: fonts.ui, fontSize: font.caption, lineHeight: 16 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  nextText: { flex: 1, fontSize: font.body, fontWeight: '700' },
  plus: { height: 36, minWidth: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  plusText: { fontFamily: fonts.uiSemibold, fontSize: font.body },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seasonChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1 },
  seasonChipText: { fontFamily: fonts.uiSemibold, fontSize: font.footnote },
  seasonAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed' },
  seasonAllText: { fontFamily: fonts.uiSemibold, fontSize: font.caption },
  episode: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  epNum: { fontFamily: fonts.display, fontSize: 26, width: 32, textAlign: 'center' },
  epName: { fontSize: font.body, fontWeight: '600' },
  epMeta: { fontFamily: fonts.ui, fontSize: font.caption, marginTop: 2 },
  epRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  epRatingText: { marginTop: 0 },
});
