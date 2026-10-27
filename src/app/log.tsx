import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { details, tmdbKey } from '@/api';
import { Chip, StarInput } from '@/components/Film';
import { Hero } from '@/components/Hero';
import { useToast } from '@/components/Toast';
import { daysAgo, friendlyDate, isoDate, parseIso, today } from '@/lib/dates';
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
};

function blankDraft(t: Title): EntryDraft {
  return {
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
    watchedOn: today(),
    rating: 0,
    liked: false,
    rewatch: false,
    progress: '',
    review: '',
    spoilers: false,
    tags: [],
  };
}

const parseTags = (s: string) => [...new Set(s.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean))];

export default function LogScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<Params>();
  const { settings } = useSettings();
  const { getEntry, viewingsOf, addEntry, updateEntry, deleteEntry, restoreEntry, onWatchlist, addToWatchlist } = useDiary();

  const editing = params.id ? getEntry(params.id) : undefined;
  const manual = !editing && !params.again && !params.title;

  const [draft, setDraft] = useState<EntryDraft>(() => {
    if (editing) return editing;
    const prev = params.again ? getEntry(params.again) : undefined;
    if (prev) return { ...prev, watchedOn: today(), rewatch: true, review: '', spoilers: false, progress: '', tags: [] };
    if (params.title) {
      const t = JSON.parse(params.title) as Title;
      return { ...blankDraft(t), rewatch: viewingsOf(t.source, t.sourceId).length > 0 };
    }
    return blankDraft({ kind: params.manual ?? 'movie', source: 'manual', sourceId: '', title: '', year: null, posterUrl: null, backdropUrl: null, genres: [], runtime: null });
  });
  const [tagText, setTagText] = useState(() => draft.tags.join(', '));
  const [yearText, setYearText] = useState(() => (draft.year ? String(draft.year) : ''));
  const [iosPicker, setIosPicker] = useState(false);
  const set = (patch: Partial<EntryDraft>) => setDraft((d) => ({ ...d, ...patch }));

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
        onChange: (e, d) => e.type === 'set' && d && set({ watchedOn: isoDate(d) }),
      });
    } else {
      setIosPicker((v) => !v);
    }
  };

  const series = draft.kind !== 'movie';
  // New entries only: whether this title is waiting on the watchlist (logging takes it off).
  const queued = !editing && draft.title.trim() ? onWatchlist(draft) : undefined;
  const canSave = draft.title.trim().length > 0;
  const quickDate = useMemo(() => (draft.watchedOn === today() ? 'today' : draft.watchedOn === daysAgo(1) ? 'yesterday' : 'other'), [draft.watchedOn]);

  const save = () => {
    if (!canSave) {
      toast('Give it a title first');
      return;
    }
    const year = Number(yearText);
    const final: EntryDraft = {
      ...draft,
      title: draft.title.trim(),
      year: manual ? (year >= 1870 && year <= 2100 ? year : null) : draft.year,
      tags: parseTags(tagText),
      review: draft.review.trim(),
      progress: draft.progress.trim(),
    };
    if (editing) updateEntry(editing.id, final);
    else addEntry(final);
    if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toast(editing ? 'Entry updated' : `Logged · ${friendlyDate(final.watchedOn)}${queued ? ' · off your watchlist' : ''}`);
    if (router.canGoBack()) router.back();
    else router.replace('/');
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
    });
    toast('Saved to your watchlist');
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const remove = () => {
    if (!editing) return;
    deleteEntry(editing.id);
    toast(`Moved “${editing.title}” to Trash`, { label: 'Undo', onPress: () => restoreEntry(editing.id) });
    router.dismissTo('/');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: editing ? 'EDIT ENTRY' : manual ? 'ADD BY HAND' : '',
          headerTransparent: !manual,
          headerTintColor: manual ? theme.text : '#FFFFFF',
          headerRight: () => (
            <Pressable onPress={save} hitSlop={10} accessibilityRole="button" accessibilityLabel="Save">
              <Text style={[styles.headerSave, { color: manual ? theme.accent : '#FFFFFF' }]}>SAVE</Text>
            </Pressable>
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
          <Hero t={draft} theme={theme} topInset={insets.top} />
        )}

        <View style={styles.form}>
          {queued && (
            <View style={[styles.queued, { borderColor: theme.accent + '66', backgroundColor: theme.accentSoft }]}>
              <Ionicons name="bookmark" size={16} color={theme.accent} />
              <Text style={[styles.queuedText, { color: theme.text }]}>On your watchlist. Logging it takes it off.</Text>
            </View>
          )}
          <Field theme={theme} label="Watched on">
            <View style={styles.row}>
              <Chip theme={theme} label="Today" active={quickDate === 'today'} onPress={() => set({ watchedOn: today() })} />
              <Chip theme={theme} label="Yesterday" active={quickDate === 'yesterday'} onPress={() => set({ watchedOn: daysAgo(1) })} />
              <Chip theme={theme} icon="calendar-outline" label={quickDate === 'other' ? friendlyDate(draft.watchedOn) : 'Pick a date'} active={quickDate === 'other'} onPress={pickDate} />
            </View>
            {iosPicker && Platform.OS === 'ios' && (
              <DateTimePicker
                value={parseIso(draft.watchedOn)}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                onChange={(_, d) => d && set({ watchedOn: isoDate(d) })}
              />
            )}
          </Field>

          <Field theme={theme} label="Your rating">
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
                <Ionicons name={draft.liked ? 'heart' : 'heart-outline'} size={36} color={draft.liked ? theme.like : theme.textMuted} />
                <Text style={[styles.likeText, { color: draft.liked ? theme.like : theme.textMuted }]}>{draft.liked ? 'LOVED' : 'LIKE'}</Text>
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: theme.textMuted }]}>Slide across the stars; the left half of a star is a half. Tap your rating again to clear it.</Text>
          </Field>

          <ToggleLine
            theme={theme}
            icon="repeat"
            label={series ? 'Rewatch (seen it before)' : 'I’ve seen this before'}
            value={draft.rewatch}
            onChange={(rewatch) => set({ rewatch })}
          />

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

          <Field theme={theme} label="Review">
            <TextInput
              value={draft.review}
              onChangeText={(review) => set({ review })}
              placeholder="What stayed with you after the credits?"
              placeholderTextColor={theme.textMuted}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.review, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
            />
          </Field>
          <ToggleLine theme={theme} icon="eye-off-outline" label="Contains spoilers" value={draft.spoilers} onChange={(spoilers) => set({ spoilers })} />

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
            <Pressable onPress={remove} accessibilityRole="button" style={styles.delete}>
              <Ionicons name="trash-outline" size={16} color={theme.danger} />
              <Text style={[styles.deleteText, { color: theme.danger }]}>MOVE TO TRASH</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ theme, label, children }: { theme: Theme; label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textMuted }]}>{label.toUpperCase()}</Text>
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
  headerSave: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1 },
  manual: { padding: 16, gap: 18 },
  form: { padding: 16, gap: 20 },
  field: { gap: 8 },
  label: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1.5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: font.body },
  titleInput: { fontFamily: fonts.display, fontSize: 28, paddingVertical: 6 },
  review: { minHeight: 120, lineHeight: 21 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ratingValue: { fontFamily: fonts.display, fontSize: 36, width: 44, includeFontPadding: false },
  like: { alignItems: 'center', marginLeft: 'auto' },
  likeText: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1 },
  hint: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 16 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 50 },
  toggleText: { flex: 1, fontSize: font.body, fontWeight: '600' },
  logIt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: 27, marginTop: 4 },
  logItText: { fontFamily: fonts.monoBold, fontSize: font.headline, letterSpacing: 2 },
  queued: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  queuedText: { fontFamily: fonts.mono, fontSize: font.footnote, flex: 1 },
  later: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed' },
  laterText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  deleteText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
});
