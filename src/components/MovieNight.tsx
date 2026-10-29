import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import { Poster } from '@/components/Film';
import { useToast } from '@/components/Toast';
import { cancelMovieNight, scheduleMovieNight } from '@/lib/movieNight';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import type { MovieNight } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Title } from '@/store/types';

const HOUR = 3600000;

/** "Tonight, 8:00 pm", "Tomorrow, 8:00 pm", "Sat 1 Nov, 8:00 pm". */
export function nightLabel(at: number, now = new Date()) {
  const d = new Date(at);
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / (24 * HOUR));
  if (diff === 0) return `Tonight, ${time}`;
  if (diff === 1) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

const at = (base: Date, addDays: number, hour: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + addDays, hour, 0, 0, 0);

/** The quick choices: tonight (while there's time), tomorrow, and the coming Saturday, at 8 pm. */
function quickTimes(now = new Date()) {
  const out: { label: string; date: Date }[] = [];
  const tonight = at(now, 0, 20);
  if (tonight.getTime() - now.getTime() > 30 * 60000) out.push({ label: 'Tonight, 8 pm', date: tonight });
  out.push({ label: 'Tomorrow, 8 pm', date: at(now, 1, 20) });
  const toSat = (6 - now.getDay() + 7) % 7 || 7;
  if (toSat > 1) out.push({ label: 'This Saturday, 8 pm', date: at(now, toSat, 20) });
  return out;
}

/** Your planned movie nights, soonest first (a night stays listed for three hours after it starts), and ways to change them. */
export function useMovieNights() {
  const { settings, update } = useSettings();
  const { onWatchlist, addToWatchlist } = useDiary();
  const toast = useToast();
  // The time, kept fresh each minute, so a night drops off the list three hours after it starts.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const nights = [...settings.movieNights].filter((n) => n.at > now - 3 * HOUR).sort((a, b) => a.at - b.at);

  const plan = async (t: Title, date: Date) => {
    const reminderId = await scheduleMovieNight(t, date).catch(() => null);
    const night: MovieNight = {
      key: `${t.sourceId}:${date.getTime()}`,
      reminderId,
      at: date.getTime(),
      kind: t.kind,
      source: t.source,
      sourceId: t.sourceId,
      title: t.title,
      year: t.year,
      posterUrl: t.posterUrl,
      backdropUrl: t.backdropUrl,
    };
    // One night per title: planning again moves it.
    const old = settings.movieNights.filter((n) => n.sourceId === t.sourceId);
    await Promise.all(old.map((n) => cancelMovieNight(n.reminderId)));
    update({ movieNights: [...settings.movieNights.filter((n) => n.sourceId !== t.sourceId), night] });
    if (!onWatchlist(t)) addToWatchlist(t, `Movie night · ${nightLabel(night.at)}`);
    toast(
      reminderId
        ? `Movie night planned: ${nightLabel(night.at)}. You’ll get a reminder.`
        : Platform.OS === 'web'
          ? `Movie night planned: ${nightLabel(night.at)}`
          : `Planned for ${nightLabel(night.at)}. Turn on notifications for Watch Heart to get a reminder.`,
    );
  };

  const cancel = async (n: MovieNight) => {
    await cancelMovieNight(n.reminderId);
    update({ movieNights: settings.movieNights.filter((x) => x.key !== n.key) });
    toast('Movie night cancelled');
  };

  return { nights, plan, cancel, forTitle: (sourceId: string) => nights.find((n) => n.sourceId === sourceId) };
}

/** Choose when: tonight, tomorrow, Saturday, or any day and time. */
export function MovieNightSheet({ t, visible, theme, onClose }: { t: Title; visible: boolean; theme: Theme; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { plan } = useMovieNights();
  const choose = (date: Date) => {
    onClose();
    plan(t, date).catch(() => {});
  };
  // Android's own pickers: the day, then the time.
  const pickAny = () => {
    const now = new Date();
    DateTimePickerAndroid.open({
      value: at(now, 0, 20),
      mode: 'date',
      minimumDate: now,
      onChange: (e, day) => {
        if (e.type !== 'set' || !day) return;
        DateTimePickerAndroid.open({
          value: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 20, 0),
          mode: 'time',
          onChange: (e2, time) => {
            if (e2.type !== 'set' || !time) return;
            const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes());
            if (when.getTime() > Date.now()) choose(when);
          },
        });
      },
    });
  };
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        <Text style={[styles.sheetTitle, { color: theme.text }]}>MOVIE NIGHT</Text>
        <Text style={[styles.sheetSub, { color: theme.textMuted }]} numberOfLines={2}>
          When are you watching {t.title}? You’ll get a reminder then.
        </Text>
        {quickTimes().map((q) => (
          <Pressable
            key={q.label}
            onPress={() => choose(q.date)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.option, { backgroundColor: pressed ? theme.chip : theme.bg, borderColor: theme.border }]}
          >
            <Ionicons name="calendar-outline" size={18} color={theme.accent} />
            <Text style={[styles.optionText, { color: theme.text }]}>{q.label}</Text>
          </Pressable>
        ))}
        {Platform.OS === 'android' && (
          <Pressable
            onPress={() => {
              onClose();
              pickAny();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.option, { backgroundColor: pressed ? theme.chip : theme.bg, borderColor: theme.border }]}
          >
            <Ionicons name="time-outline" size={18} color={theme.accent} />
            <Text style={[styles.optionText, { color: theme.text }]}>Pick a day and time…</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
}

/** A planned night: the title, when, and a way to cancel. On the title page, and the next one on Home. */
export function MovieNightCard({ night, theme, showTitle }: { night: MovieNight; theme: Theme; showTitle?: boolean }) {
  const { cancel } = useMovieNights();
  return (
    <View style={[styles.card, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
      <Pressable
        onPress={() => showTitle && router.push({ pathname: '/title/[id]', params: { id: night.sourceId } })}
        disabled={!showTitle}
        accessibilityRole={showTitle ? 'button' : undefined}
        style={styles.cardMain}
      >
        {showTitle ? (
          <Poster uri={night.posterUrl} title={night.title} width={40} theme={theme} radius={4} />
        ) : (
          <Ionicons name="calendar" size={26} color={theme.accent} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.cardKicker, { color: theme.accent }]}>MOVIE NIGHT</Text>
          <Text style={[styles.cardWhen, { color: theme.text }]}>{nightLabel(night.at)}</Text>
          {showTitle && (
            <Text style={[styles.cardTitle, { color: theme.textMuted }]} numberOfLines={1}>
              {night.title}
            </Text>
          )}
        </View>
      </Pressable>
      <Pressable onPress={() => cancel(night)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel movie night" style={styles.cancel}>
        <Ionicons name="close" size={20} color={theme.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, gap: 10 },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 4 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 28, letterSpacing: 1 },
  sheetSub: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17, marginBottom: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  optionText: { fontSize: font.body, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardKicker: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1.5 },
  cardWhen: { fontSize: font.body, fontWeight: '700' },
  cardTitle: { fontFamily: fonts.mono, fontSize: font.caption },
  cancel: { padding: 6 },
});
