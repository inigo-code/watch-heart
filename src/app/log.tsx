import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/AppText';
import { details, tmdbKey } from '@/api';
import { KeyboardSafe } from '@/components/KeyboardSafe';
import { BackDisc } from '@/components/BackDisc';
import { CompanionField } from '@/components/CompanionField';
import { DangerButton } from '@/components/DangerButton';
import { ConfirmTrash } from '@/components/ConfirmTrash';
import { Chip, StarInput } from '@/components/Film';
import { Hero } from '@/components/Hero';
import { LoggedStamp } from '@/components/LoggedStamp';
import { Pop, Tap, useReducedMotion } from '@/components/Motion';
import { SectionLabel } from '@/components/SectionLabel';
import { ViewingDetails } from '@/components/ViewingDetails';
import { showInfo, trackable } from '@/api/episodes';
import { TitlePicker } from '@/components/TitlePicker';
import { useToast } from '@/components/Toast';
import { daysAgo, friendlyDate, isoDate, parseIso, today } from '@/lib/dates';
import { blankDraft } from '@/lib/entryDraft';
import { easeNextLayout } from '@/lib/motion';
import { useDraftPoster } from '@/lib/posterDraft';
import { hasViewingDetails } from '@/lib/viewing';
import { buddies } from '@/lib/companions';
import { applyFormat } from '@/lib/richText';
import { KIND_LABEL } from '@/lib/stats';
import { KIND_COLORS, font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { EntryDraft, MediaKind, Title } from '@/store/types';

type Params = {
  /** Edit this entry. */
  id?: string;
  /** Log another viewing of this entry's title. */
  again?: string;
  /** A search result, as JSON. */
  title?: string;
  /** Add a title by hand, of this kind. */
  manual?: MediaKind;
  /** A series: rate and review this season (from the episodes page). */
  season?: string;
};

const parseTags = (s: string) => [...new Set(s.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean))];

/** Waits for the diary when editing (or logging again), so the form starts from the entry, not a blank one. */
export default function LogScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<Params>();
  const { ready } = useDiary();
  if ((params.id || params.again) && !ready) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  return <LogForm />;
}

function LogForm() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<Params>();
  const { settings } = useSettings();
  const { entries, getEntry, viewingsOf, addEntry, updateEntry, deleteEntry, restoreEntry, onWatchlist, addToWatchlist } = useDiary();
  // People you've watched with before, most often first, as suggestions.
  const known = useMemo(() => buddies(entries).map((b) => b.name), [entries]);

  const editing = params.id ? getEntry(params.id) : undefined;
  const manual = !editing && !params.again && !params.title;

  const [draft, setDraft] = useState<EntryDraft>(() => {
    if (editing) return editing;
    const prev = params.again ? getEntry(params.again) : undefined;
    if (prev) {
      // A new viewing: its own feelings, screen and place.
      const fresh = { vibes: [], device: null, context: [], platform: null, character: null };
      return { ...prev, ...fresh, watchedOn: today(), rewatch: true, review: '', spoilers: false, progress: '', tags: [], season: null };
    }
    if (params.title) {
      const t = JSON.parse(params.title) as Title;
      const season = Number(params.season) || null;
      return { ...blankDraft(t), season, rewatch: viewingsOf(t.source, t.sourceId).length > 0 };
    }
    return blankDraft({ kind: params.manual ?? 'movie', source: 'manual', sourceId: '', title: '', year: null, posterUrl: null, backdropUrl: null, genres: [], runtime: null });
  });
  const [tagText, setTagText] = useState(() => draft.tags.join(', '));
  const [yearText, setYearText] = useState(() => (draft.year ? String(draft.year) : ''));
  const [iosPicker, setIosPicker] = useState(false);
  const [picking, setPicking] = useState(false);
  // The extras (who, how, where, rewatch, tags) wait behind "More details", open when an entry already has some.
  const [moreOpen, setMoreOpen] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const reviewSel = useRef({ start: 0, end: 0 });
  const set = (patch: Partial<EntryDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const reduced = useReducedMotion();
  const [stamped, setStamped] = useState<string | null>(null);
  const closeForm = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/diary')), []);
  // A poster chosen on the poster screen before logging comes back here.
  const takePoster = useCallback((c: { posterUrl: string | null; posterPick: string | null }) => setDraft((d) => ({ ...d, posterUrl: c.posterUrl, posterPick: c.posterPick })), []);
  useDraftPoster(draft.sourceId, takePoster);

  const format = (kind: 'bold' | 'italic' | 'quote') => {
    const r = applyFormat(draft.review, reviewSel.current, kind);
    reviewSel.current = r.selection;
    set({ review: r.text });
  };

  /** A wrong match fixed: the picked title's details, with this entry's own date, rating and words. */
  const repick = (t: Title) => {
    setPicking(false);
    set({
      kind: t.kind,
      source: t.source,
      sourceId: t.sourceId,
      title: t.title,
      originalTitle: t.originalTitle ?? null,
      year: t.year,
      posterUrl: t.posterUrl,
      backdropUrl: t.backdropUrl,
      genres: t.genres,
      runtime: t.runtime,
      credit: t.credit ?? null,
      fetchedAt: t.source === 'tmdb' ? Date.now() : null,
      imdbId: null,
      matchTriedAt: null,
    });
    setYearText(t.year ? String(t.year) : '');
    details(t, tmdbKey(settings.tmdbKey)).then((full) =>
      setDraft((d) => (d.sourceId === t.sourceId ? { ...d, genres: full.genres.length ? full.genres : d.genres, runtime: full.runtime ?? d.runtime, credit: full.credit ?? d.credit } : d)),
    );
  };

  // Search results leave out running time, full genres and the director; fetch them while you fill in the rest.
  useEffect(() => {
    if (editing || !params.title) return;
    const controller = new AbortController();
    const t = JSON.parse(params.title) as Title;
    details(t, tmdbKey(settings.tmdbKey), controller.signal).then((full) => {
      if (controller.signal.aborted) return;
      setDraft((d) => ({ ...d, genres: full.genres.length ? full.genres : d.genres, runtime: full.runtime ?? d.runtime, credit: full.credit ?? d.credit }));
    });
    return () => controller.abort();
    // Only once, for the title this screen opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickDate = () => {
    const value = parseIso(draft.watchedOn);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (e, d) => e.type === 'set' && d && set({ watchedOn: isoDate(d), undated: false }),
      });
    } else {
      setIosPicker((v) => !v);
    }
  };

  const series = draft.kind !== 'movie';
  // A show's seasons, so a rating and review can be for one of them.
  const [seasons, setSeasons] = useState<number[]>([]);
  const showSource = series && trackable(draft) ? draft.source : null;
  const showId = draft.sourceId;
  useEffect(() => {
    if (!showSource) return;
    const controller = new AbortController();
    showInfo(settings.tmdbKey, showSource, showId, controller.signal)
      .then((i) => !controller.signal.aborted && setSeasons(i.seasons.map((x) => x.n)))
      .catch(() => {});
    return () => controller.abort();
  }, [settings.tmdbKey, showSource, showId]);
  const seasonChoices = draft.season && !seasons.includes(draft.season) ? [...seasons, draft.season].sort((a, b) => a - b) : seasons;
  // New entries only: whether this title is waiting on the watchlist (logging takes it off).
  const queued = !editing && draft.title.trim() ? onWatchlist(draft) : undefined;
  const canSave = draft.title.trim().length > 0;
  // "unknown": watched long ago, date forgotten. Such entries go in the Diary's Archive, like undated imports.
  const quickDate = useMemo(
    () => (draft.undated ? 'unknown' : draft.watchedOn === today() ? 'today' : draft.watchedOn === daysAgo(1) ? 'yesterday' : 'other'),
    [draft.undated, draft.watchedOn],
  );

  const save = () => {
    if (stamped) return;
    if (!canSave) {
      toast('Give it a title first');
      return;
    }
    const year = Number(yearText);
    const final: EntryDraft = {
      ...draft,
      // "Don't remember" keeps it in the Archive; picking any date files it under that month.
      undated: draft.undated ? true : undefined,
      title: draft.title.trim(),
      year: manual ? (year >= 1870 && year <= 2100 ? year : null) : draft.year,
      tags: parseTags(tagText),
      review: draft.review.trim(),
      progress: draft.progress.trim(),
      season: series && draft.season ? draft.season : null,
    };
    if (editing) updateEntry(editing.id, final);
    else addEntry(final);
    if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast(editing ? 'Entry updated' : `Logged · ${friendlyDate(final.watchedOn)}${queued ? ' · off your watchlist' : ''}`);
    // A new entry gets the stamp, which closes the form when it's done.
    if (editing || reduced) closeForm();
    else setStamped(final.title);
  };

  const saveForLater = () => {
    if (!canSave) {
      toast('Give it a title first');
      return;
    }
    const year = Number(yearText);
    addToWatchlist({
      kind: draft.kind,
      source: draft.source,
      sourceId: draft.sourceId,
      title: draft.title.trim(),
      originalTitle: draft.originalTitle ?? undefined,
      year: manual ? (year >= 1870 && year <= 2100 ? year : null) : draft.year,
      posterUrl: draft.posterUrl,
      backdropUrl: draft.backdropUrl,
      genres: draft.genres,
      runtime: draft.runtime,
      credit: draft.credit,
      fetchedAt: draft.fetchedAt,
    });
    toast('Saved to your watchlist');
    if (router.canGoBack()) router.back();
    else router.replace('/diary');
  };

  const remove = () => {
    if (!editing) return;
    deleteEntry(editing.id);
    toast(`Moved “${editing.title}” to Trash`, { label: 'Undo', onPress: () => restoreEntry(editing.id) });
    router.dismissTo('/');
  };

  const detailCount = [
    !!draft.companions?.length,
    hasViewingDetails(draft),
    draft.rewatch,
    !!tagText.trim(),
  ].filter(Boolean).length;
  const showMore = moreOpen || (editing ? detailCount > 0 : false);

  return (
    <KeyboardSafe style={{ backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: editing ? 'EDIT ENTRY' : manual ? 'ADD BY HAND' : '',
          headerTransparent: !manual,
          headerStyle: { backgroundColor: manual ? theme.bg : 'transparent' },
          headerTintColor: theme.text,
          headerBackVisible: manual,
          headerLeft: manual ? undefined : () => <BackDisc />,
          headerRight: () => (
            <Tap onPress={save} hitSlop={10} accessibilityRole="button" accessibilityLabel="Save" style={!manual && styles.headerSaveDisc}>
              <Text style={[styles.headerSave, { color: manual ? theme.accent : '#FFFFFF' }]}>SAVE</Text>
            </Tap>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {manual ? (
          <View style={styles.manual}>
            <Field theme={theme} label="Kind">
              <View style={styles.row}>
                {(['movie', 'tv', 'anime'] as MediaKind[]).map((k) => (
                  <Chip key={k} theme={theme} label={KIND_LABEL[k]} color={KIND_COLORS[k]} active={draft.kind === k} onPress={() => set({ kind: k })} />
                ))}
              </View>
            </Field>
            <Field theme={theme} label="Title">
              <TextInput
                value={draft.title}
                onChangeText={(title) => set({ title })}
                placeholder="What did you watch?"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, styles.titleInput, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
                autoFocus
              />
            </Field>
            <Field theme={theme} label="Year">
              <TextInput
                value={yearText}
                onChangeText={(t) => setYearText(t.replace(/\D/g, '').slice(0, 4))}
                placeholder="e.g. 1994"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border, width: 120 }]}
              />
            </Field>
          </View>
        ) : (
          <Hero
            t={draft}
            theme={theme}
            topInset={insets.top}
            onPoster={
              draft.source === 'tmdb' && draft.sourceId
                ? () =>
                    router.push({
                      pathname: '/poster/[id]',
                      params: { id: 'draft', sourceId: draft.sourceId, title: draft.title, current: draft.posterUrl ?? '', picked: draft.posterPick ?? '' },
                    })
                : undefined
            }
          />
        )}

        <View style={styles.form}>
          {!editing && trackable(draft) && (
            <Pressable
              onPress={() => {
                // Close the form first, so the episodes page opens inside the tab you came from (replacing the
                // form put a second set of tabs on top, with no way back).
                const title = params.title ?? JSON.stringify({ ...draft, originalTitle: draft.originalTitle ?? undefined });
                router.back();
                router.push({ pathname: '/track', params: { title } });
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.repick, { borderColor: theme.accent + '88', opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="list-outline" size={18} color={theme.accent} />
              <Text style={[styles.repickText, { color: theme.text }]}>Track it episode by episode instead</Text>
            </Pressable>
          )}
          {editing && (
            <Field theme={theme} label="Kind">
              <View style={styles.row}>
                {(['movie', 'tv', 'anime'] as MediaKind[]).map((k) => (
                  <Chip key={k} theme={theme} label={KIND_LABEL[k]} color={KIND_COLORS[k]} active={draft.kind === k} onPress={() => set({ kind: k })} />
                ))}
              </View>
              <Pressable onPress={() => setPicking(true)} accessibilityRole="button" style={({ pressed }) => [styles.repick, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="swap-horizontal" size={18} color={theme.accent} />
                <Text style={[styles.repickText, { color: theme.text }]}>Wrong title or poster? Find the right one</Text>
              </Pressable>
            </Field>
          )}
          {queued && (
            <View style={[styles.queued, { borderColor: theme.accent + '66', backgroundColor: theme.accentSoft }]}>
              <Ionicons name="bookmark" size={16} color={theme.accent} />
              <Text style={[styles.queuedText, { color: theme.text }]}>On your watchlist. Logging it takes it off.</Text>
            </View>
          )}
          <Field theme={theme} label="Watched on">
            <View style={styles.row}>
              <Chip theme={theme} label="Today" active={quickDate === 'today'} onPress={() => set({ watchedOn: today(), undated: false })} />
              <Chip theme={theme} label="Yesterday" active={quickDate === 'yesterday'} onPress={() => set({ watchedOn: daysAgo(1), undated: false })} />
              <Chip theme={theme} icon="calendar-outline" label={quickDate === 'other' ? friendlyDate(draft.watchedOn) : 'Pick a date'} active={quickDate === 'other'} onPress={pickDate} />
              <Chip theme={theme} icon="help-circle-outline" label="Don’t remember" active={quickDate === 'unknown'} onPress={() => set({ undated: true, watchedOn: today() })} />
            </View>
            {quickDate === 'unknown' && (
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                It goes in The Archive at the end of your Diary, and counts in your totals and achievements, not in a month’s recap.
              </Text>
            )}
            {iosPicker && Platform.OS === 'ios' && (
              <DateTimePicker
                value={parseIso(draft.watchedOn)}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                onChange={(_, d) => d && set({ watchedOn: isoDate(d), undated: false })}
              />
            )}
          </Field>

          {series && seasonChoices.length > 0 && (
            <Field theme={theme} label="Rating and review for">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonRow}>
                <Chip theme={theme} label="Whole show" active={!draft.season} onPress={() => set({ season: null })} />
                {seasonChoices.map((n) => (
                  <Chip key={n} theme={theme} label={`Season ${n}`} active={draft.season === n} onPress={() => set({ season: n })} />
                ))}
              </ScrollView>
            </Field>
          )}

          <Field theme={theme} label={draft.season ? `Your rating · Season ${draft.season}` : 'Your rating'}>
            <View style={styles.ratingRow}>
              <StarInput value={draft.rating} onChange={(rating) => set({ rating })} theme={theme} size={38} />
              <Text style={[styles.ratingValue, { color: draft.rating ? theme.star : theme.textMuted }]}>
                {draft.rating ? (draft.rating / 2).toFixed(1) : '—'}
              </Text>
              <Pressable
                onPress={() => {
                  if (settings.haptics && !draft.liked) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  set({ liked: !draft.liked });
                }}
                hitSlop={8}
                accessibilityRole="switch"
                accessibilityLabel="Like"
                accessibilityState={{ checked: draft.liked }}
                style={styles.like}
              >
                <Pop when={draft.liked}>
                  <Ionicons name={draft.liked ? 'heart' : 'heart-outline'} size={36} color={draft.liked ? theme.like : theme.textMuted} />
                </Pop>
                <Text style={[styles.likeText, { color: draft.liked ? theme.like : theme.textMuted }]}>{draft.liked ? 'LOVED' : 'LIKE'}</Text>
              </Pressable>
            </View>
          </Field>

          {series && (
            <Field theme={theme} label="What you watched">
              <TextInput
                value={draft.progress}
                onChangeText={(progress) => set({ progress })}
                placeholder="e.g. Season 2 · Ep 1–8"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
              />
            </Field>
          )}

          <Field theme={theme} label={draft.season ? `Review · Season ${draft.season}` : 'Review'}>
            <View style={styles.formatBar}>
              {([
                ['bold', 'B', { fontWeight: '800' }],
                ['italic', 'I', { fontStyle: 'italic', fontWeight: '700' }],
                ['quote', '❝', { fontWeight: '700' }],
              ] as const).map(([kind, label, look]) => (
                <Pressable
                  key={kind}
                  onPress={() => format(kind)}
                  accessibilityRole="button"
                  accessibilityLabel={kind === 'quote' ? 'Quote' : kind === 'bold' ? 'Bold' : 'Italic'}
                  style={({ pressed }) => [styles.formatButton, { borderColor: theme.border, backgroundColor: pressed ? theme.elevated : theme.card }]}
                >
                  <Text style={[styles.formatLabel, look, { color: theme.text }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={draft.review}
              onChangeText={(review) => set({ review })}
              onSelectionChange={(e) => (reviewSel.current = e.nativeEvent.selection)}
              placeholder="What stayed with you after the credits?"
              placeholderTextColor={theme.textMuted}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.review, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
            />
          </Field>
          {(!!draft.review.trim() || draft.spoilers) && (
            <ToggleLine theme={theme} icon="eye-off-outline" label="Contains spoilers" value={draft.spoilers} onChange={(spoilers) => set({ spoilers })} />
          )}

          <Pressable
            onPress={() => {
              easeNextLayout();
              setMoreOpen((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: showMore }}
            style={({ pressed }) => [styles.more, { borderColor: theme.border, backgroundColor: pressed ? theme.chip : 'transparent' }]}
          >
            <Ionicons name="options-outline" size={18} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.moreTitle, { color: theme.text }]}>More details</Text>
              <Text style={[styles.moreNote, { color: theme.textMuted }]} numberOfLines={1}>
                {detailCount ? `${detailCount} added · ` : ''}Who, where, on what, vibes, rewatch, tags
              </Text>
            </View>
            <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
          </Pressable>

          {showMore && (
            <>
              <Field theme={theme} label="Watched with">
                <CompanionField names={draft.companions ?? []} onChange={(companions) => set({ companions })} known={known} theme={theme} />
              </Field>

              <ViewingDetails draft={draft} onChange={set} theme={theme} />

              <ToggleLine
                theme={theme}
                icon="repeat"
                label={series ? 'Rewatch (seen it before)' : 'I’ve seen this before'}
                value={draft.rewatch}
                onChange={(rewatch) => set({ rewatch })}
              />

              <Field theme={theme} label="Tags">
                <TextInput
                  value={tagText}
                  onChangeText={setTagText}
                  placeholder="cinema, with friends, imax"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
                />
              </Field>
            </>
          )}

          <Pressable
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            style={({ pressed }) => [styles.logIt, { backgroundColor: theme.accent, opacity: !canSave ? 0.5 : pressed ? 0.85 : 1 }]}
          >
            <MaterialCommunityIcons name="movie-open-check-outline" size={22} color={theme.accentText} />
            <Text style={[styles.logItText, { color: theme.accentText }]}>{editing ? 'SAVE CHANGES' : 'LOG IT'}</Text>
          </Pressable>

          {!editing && !queued && (
            <Pressable onPress={saveForLater} accessibilityRole="button" style={({ pressed }) => [styles.later, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons name="bookmark-outline" size={18} color={theme.text} />
              <Text style={[styles.laterText, { color: theme.text }]}>HAVEN’T SEEN IT? SAVE TO WATCHLIST</Text>
            </Pressable>
          )}

          {editing && (
            <DangerButton theme={theme} label="Move to trash" onPress={() => setTrashing(true)} />
          )}
        </View>
      </ScrollView>
      <ConfirmTrash title={trashing && editing ? editing.title : null} onConfirm={remove} onClose={() => setTrashing(false)} />
      <TitlePicker visible={picking} theme={theme} initialQuery={draft.title} initialKind={draft.kind} onPick={repick} onClose={() => setPicking(false)} />
      {!!stamped && <LoggedStamp theme={theme} title={stamped} onDone={closeForm} />}
    </KeyboardSafe>
  );
}

function Field({ theme, label, children }: { theme: Theme; label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <SectionLabel theme={theme}>{label}</SectionLabel>
      {children}
    </View>
  );
}

function ToggleLine({ theme, icon, label, value, onChange }: {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={[styles.toggle, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <Ionicons name={icon} size={18} color={value ? theme.accent : theme.textMuted} />
      <Text style={[styles.toggleText, { color: theme.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.accent, false: theme.border }}
        thumbColor="#ffffff"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerSave: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1, paddingHorizontal: 8 },
  manual: { padding: 16, gap: 18 },
  form: { padding: 16, gap: 20 },
  field: { gap: 8 },
  headerSaveDisc: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seasonRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: font.body },
  titleInput: { fontFamily: fonts.display, fontSize: 28, paddingVertical: 6 },
  review: { minHeight: 120, lineHeight: 21 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ratingValue: { fontFamily: fonts.display, fontSize: 36, width: 44, includeFontPadding: false },
  like: { alignItems: 'center', marginLeft: 'auto' },
  likeText: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 1 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  moreTitle: { fontSize: font.body, fontWeight: '700' },
  moreNote: { fontFamily: fonts.mono, fontSize: font.caption, marginTop: 2 },
  hint: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 16 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 50 },
  toggleText: { flex: 1, fontSize: font.body, fontWeight: '600' },
  logIt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: 27, marginTop: 4 },
  logItText: { fontFamily: fonts.monoBold, fontSize: font.headline, letterSpacing: 2 },
  queued: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  queuedText: { fontFamily: fonts.mono, fontSize: font.footnote, flex: 1 },
  later: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed' },
  laterText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
  repick: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, paddingHorizontal: 12, minHeight: 46, marginTop: 4 },
  repickText: { flex: 1, fontSize: font.footnote, fontWeight: '600' },
  formatBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formatButton: { width: 40, height: 36, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  formatLabel: { fontSize: font.headline },
  formatHint: { flex: 1, fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 15 },
});
