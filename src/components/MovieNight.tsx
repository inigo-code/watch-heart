import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { TicketPrint, TicketTear, ticketPaper } from '@/components/Diary';
import { Poster } from '@/components/Film';
import { useToast } from '@/components/Toast';
import { openInGoogleCalendar, shareCalendarFile } from '@/lib/calendar';
import { askToRemindOnTime, canRemindOnTime, cancelMovieNight, hasAlarmSwitch, scheduleMovieNight } from '@/lib/movieNight';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import type { MovieNight } from '@/settings/SettingsProvider';
import { sameTitle, useDiary } from '@/store/DiaryStore';
import type { Entry, Title } from '@/store/types';

const HOUR = 3600000;

/** "Today, 2:00 pm", "Tomorrow, 9:30 pm", "Sat 1 Nov, 8:00 pm". */
export function nightLabel(at: number, now = new Date()) {
  const d = new Date(at);
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / (24 * HOUR));
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

const startOfDay = (base: Date, addDays: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + addDays);

/** The quick days: today (until 11 pm), tomorrow, and the coming Saturday. You choose the time after. */
function quickDays(now = new Date()) {
  const out: { label: string; day: Date }[] = [];
  if (now.getHours() < 23) out.push({ label: 'Today', day: startOfDay(now, 0) });
  out.push({ label: 'Tomorrow', day: startOfDay(now, 1) });
  const toSat = (6 - now.getDay() + 7) % 7 || 7;
  if (toSat > 1) out.push({ label: 'This Saturday', day: startOfDay(now, toSat) });
  return out;
}

/**
 * Whether you've logged the film since you planned it: then the plan is done. Plans from before 1.7.6 don't
 * know when they were made, so for them a log from the day before the night onwards counts.
 */
export function nightDone(n: MovieNight, entries: Entry[]) {
  const since = n.planned ?? n.at - 24 * HOUR;
  return entries.some((e) => e.createdAt >= since && sameTitle(e, { ...n, source: n.source as Entry['source'] }));
}

/**
 * Your planned movie nights, soonest first (a night stays listed for three hours after it starts, and goes
 * once you log the film), and ways to change them.
 */
export function useMovieNights() {
  const { settings, update } = useSettings();
  const { entries, onWatchlist, addToWatchlist } = useDiary();
  const toast = useToast();
  // The time, kept fresh each minute, so a night drops off the list three hours after it starts.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const nights = [...settings.movieNights].filter((n) => n.at > now - 3 * HOUR && !nightDone(n, entries)).sort((a, b) => a.at - b.at);

  // A night whose film you've logged is cleared, reminder and all, so it doesn't ring after you've watched.
  const done = settings.movieNights.filter((n) => nightDone(n, entries));
  const doneKeys = done.map((n) => n.key).join(' ');
  useEffect(() => {
    if (!doneKeys) return;
    const keys = new Set(doneKeys.split(' '));
    settings.movieNights.filter((n) => keys.has(n.key)).forEach((n) => cancelMovieNight(n.reminderId));
    update({ movieNights: settings.movieNights.filter((n) => !keys.has(n.key)) });
    // Runs when the set of finished nights changes, not on every change to the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKeys]);

  const plan = async (t: Title, date: Date) => {
    // Once, explain the Android switch that makes reminders arrive on time, then take you to it.
    if (!settings.askedAlarms && hasAlarmSwitch() && !(await canRemindOnTime())) {
      update({ askedAlarms: true });
      const yes = await new Promise<boolean>((done) =>
        Alert.alert('Remind you on time?', 'Android holds reminders back when the app is closed. Turn on Alarms & reminders for Watch Heart and yours will arrive at the minute you choose.', [
          { text: 'Not now', style: 'cancel', onPress: () => done(false) },
          { text: 'Turn on', onPress: () => done(true) },
        ], { onDismiss: () => done(false), cancelable: true }),
      );
      if (yes) await askToRemindOnTime();
    }
    const reminderId = await scheduleMovieNight(t, date).catch(() => null);
    // One night per title: planning again moves it.
    const old = settings.movieNights.filter((n) => n.sourceId === t.sourceId);
    const night: MovieNight = {
      key: `${t.sourceId}:${date.getTime()}`,
      reminderId,
      at: date.getTime(),
      planned: old[0]?.planned ?? Date.now(),
      kind: t.kind,
      source: t.source,
      sourceId: t.sourceId,
      title: t.title,
      year: t.year,
      posterUrl: t.posterUrl,
      backdropUrl: t.backdropUrl,
    };
    await Promise.all(old.map((n) => cancelMovieNight(n.reminderId)));
    update({ movieNights: [...settings.movieNights.filter((n) => n.sourceId !== t.sourceId), night] });
    if (!onWatchlist(t)) addToWatchlist(t, `Planned for ${nightLabel(night.at)}`);
    const said = old.length ? 'Moved to' : 'Planned:';
    toast(
      reminderId
        ? `${said} ${nightLabel(night.at)}. You’ll get a reminder.`
        : Platform.OS === 'web'
          ? `${said} ${nightLabel(night.at)}`
          : `${said} ${nightLabel(night.at)}. Turn on notifications for Watch Heart to get a reminder.`,
    );
  };

  const cancel = async (n: MovieNight) => {
    await cancelMovieNight(n.reminderId);
    update({ movieNights: settings.movieNights.filter((x) => x.key !== n.key) });
    toast('Plan cancelled');
  };

  return { nights, plan, cancel, forTitle: (sourceId: string) => nights.find((n) => n.sourceId === sourceId) };
}

/**
 * Choose when: a day (today, tomorrow, Saturday or any), then the time, in Android's own pickers. With a plan
 * for the title already, it changes that one: the clock opens at its time, and the plan can be cancelled.
 */
export function MovieNightSheet({ t, visible, theme, onClose }: { t: Title; visible: boolean; theme: Theme; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { plan, cancel, forTitle } = useMovieNights();
  const toast = useToast();
  const current = forTitle(t.sourceId);
  const choose = (date: Date) => {
    onClose();
    plan(t, date).catch(() => {});
  };
  // The time is yours to choose; the clock opens at the plan's time, or else on the next full hour.
  const pickTime = (day: Date) => {
    const next = current ? new Date(current.at) : new Date();
    if (!current) next.setHours(next.getHours() + 1, 0, 0, 0);
    const opensAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), next.getHours(), next.getMinutes());
    if (Platform.OS !== 'android') {
      choose(opensAt);
      return;
    }
    onClose();
    DateTimePickerAndroid.open({
      value: opensAt,
      mode: 'time',
      onChange: (e, time) => {
        if (e.type !== 'set' || !time) return;
        const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes());
        if (when.getTime() > Date.now()) plan(t, when).catch(() => {});
        else toast('That time has passed. Pick a later one.');
      },
    });
  };
  const pickDay = () => {
    const now = new Date();
    onClose();
    DateTimePickerAndroid.open({
      value: current && current.at > now.getTime() ? new Date(current.at) : now,
      mode: 'date',
      minimumDate: now,
      onChange: (e, day) => e.type === 'set' && day && pickTime(day),
    });
  };
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <Text style={[styles.sheetTitle, { color: theme.text }]}>{current ? 'Change the plan' : 'Plan a watch'}</Text>
        <Text style={[styles.sheetSub, { color: theme.textMuted }]} numberOfLines={2}>
          {current
            ? `${t.title} is planned for ${nightLabel(current.at).replace(/^(Today|Tomorrow)/, (m) => m.toLowerCase())}. Pick a new day, then the time.`
            : `When are you watching ${t.title}? Pick the day, then the time, and you’ll get a reminder then.`}
        </Text>
        {quickDays().map((q) => (
          <Pressable
            key={q.label}
            onPress={() => pickTime(q.day)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.option, { backgroundColor: pressed ? theme.chip : theme.bg, borderColor: theme.border }]}
          >
            <Ionicons name="calendar-outline" size={18} color={theme.accent} />
            <Text style={[styles.optionText, { color: theme.text }]}>{q.label}</Text>
          </Pressable>
        ))}
        {Platform.OS === 'android' && (
          <Pressable
            onPress={pickDay}
            accessibilityRole="button"
            style={({ pressed }) => [styles.option, { backgroundColor: pressed ? theme.chip : theme.bg, borderColor: theme.border }]}
          >
            <Ionicons name="time-outline" size={18} color={theme.accent} />
            <Text style={[styles.optionText, { color: theme.text }]}>Another day…</Text>
          </Pressable>
        )}
        {current && (
          <Pressable
            onPress={() => {
              onClose();
              cancel(current).catch(() => {});
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.option, { backgroundColor: pressed ? theme.chip : theme.bg, borderColor: theme.border }]}
          >
            <Ionicons name="close-circle-outline" size={18} color={theme.danger} />
            <Text style={[styles.optionText, { color: theme.danger }]}>Cancel the plan</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}

/**
 * A planned night, printed as a ticket for the show: the day and time on the stub, then the title and a
 * way to cancel. On the title page, and the next one on Home.
 */
/** Into your own calendar: Google Calendar with the event filled in, or a file for any other calendar app. */
function addToCalendar(night: MovieNight) {
  Alert.alert('Add to calendar', `Watch ${night.title}, ${nightLabel(night.at)}`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Calendar file', onPress: () => void shareCalendarFile(night).catch(() => {}) },
    { text: 'Google Calendar', onPress: () => void openInGoogleCalendar(night).catch(() => {}) },
  ]);
}

/** The planned title, enough for the sheet to move its plan. */
const nightTitle = (n: MovieNight): Title => ({
  kind: n.kind,
  source: n.source as Title['source'],
  sourceId: n.sourceId,
  title: n.title,
  year: n.year,
  posterUrl: n.posterUrl,
  backdropUrl: n.backdropUrl,
  genres: [],
  runtime: null,
});

export function MovieNightCard({ night, theme, showTitle }: { night: MovieNight; theme: Theme; showTitle?: boolean }) {
  const { cancel } = useMovieNights();
  const [editing, setEditing] = useState(false);
  const p = ticketPaper(night.kind, theme);
  const d = new Date(night.at);
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '');
  return (
    <View style={[styles.ticket, { backgroundColor: p.paper, borderColor: p.border }]}>
      <TicketPrint kind={night.kind} theme={theme} />
      <View style={styles.stub} accessible accessibilityLabel={`Planned for ${nightLabel(night.at)}`}>
        <Text style={[styles.stubDay, { color: theme.textMuted }]}>{d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()}</Text>
        <Text style={[styles.stubDate, { color: theme.text }]}>{d.getDate()}</Text>
        <Text style={[styles.stubTime, { color: theme.textMuted }]}>{time.toUpperCase()}</Text>
      </View>
      <TicketTear theme={theme} border={p.border} />
      <Pressable
        onPress={() => (showTitle ? router.push({ pathname: '/title/[id]', params: { id: night.sourceId } }) : setEditing(true))}
        accessibilityRole="button"
        accessibilityHint={showTitle ? undefined : 'Change the day or time'}
        style={styles.cardMain}
      >
        {showTitle && <Poster uri={night.posterUrl} title={night.title} width={40} theme={theme} radius={3} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.admit, { color: theme.textMuted }]}>{'ADMIT ONE   PLANNED'}</Text>
          <Text style={[styles.cardWhen, { color: theme.text }]} numberOfLines={2}>
            {showTitle ? night.title : nightLabel(night.at)}
          </Text>
          {showTitle && <Text style={[styles.cardTitle, { color: theme.textMuted }]}>{nightLabel(night.at)}</Text>}
        </View>
      </Pressable>
      <Pressable onPress={() => setEditing(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Change the plan" style={styles.cancel}>
        <Ionicons name="create-outline" size={19} color={theme.textMuted} />
      </Pressable>
      <Pressable onPress={() => addToCalendar(night)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Add to calendar" style={styles.cancel}>
        <Ionicons name="calendar-outline" size={19} color={theme.textMuted} />
      </Pressable>
      <Pressable onPress={() => cancel(night)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel the plan" style={styles.cancel}>
        <Ionicons name="close" size={20} color={theme.textMuted} />
      </Pressable>
      <MovieNightSheet t={nightTitle(night)} visible={editing} theme={theme} onClose={() => setEditing(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, gap: 10 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 4 },
  sheetTitle: { fontFamily: fonts.uiSemibold, fontSize: font.title2 },
  sheetSub: { fontFamily: fonts.ui, fontSize: font.caption, lineHeight: 17, marginBottom: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  optionText: { fontSize: font.body, fontWeight: '600' },
  // The same paper and tear as a Diary ticket.
  ticket: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 7, paddingRight: 6, gap: 10, overflow: 'hidden' },
  stub: { minWidth: 64, paddingLeft: 8, alignItems: 'center' },
  stubDay: { fontFamily: fonts.ticketBold, fontSize: 12, letterSpacing: 1 },
  stubDate: { fontFamily: fonts.display, fontSize: 30, lineHeight: 31, includeFontPadding: false },
  stubTime: { fontFamily: fonts.ticketBold, fontSize: 11 },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  admit: { fontFamily: fonts.ticketBold, fontSize: 11, letterSpacing: 1 },
  cardWhen: { fontSize: font.body, fontWeight: '700' },
  cardTitle: { fontFamily: fonts.ui, fontSize: font.caption },
  cancel: { padding: 6 },
});
