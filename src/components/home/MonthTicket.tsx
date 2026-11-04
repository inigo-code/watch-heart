import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { ticketPaper, TicketPrint } from '@/components/Diary';
import { Poster } from '@/components/Film';
import { CountUp, Rise, Tap } from '@/components/Motion';
import { monthName, today } from '@/lib/dates';
import { computeStats } from '@/lib/stats';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import type { Entry } from '@/store/types';

const NOTCH = 14;
const SHOWN = 5;

/**
 * The top of Home: your month, as a ticket from the Diary. How much you've watched and the latest posters,
 * then the one thing this app is for: logging what you watched.
 */
export function MonthTicket({ entries, theme }: { entries: Entry[]; theme: Theme }) {
  const now = today();
  const key = now.slice(0, 7);
  const month = entries.filter((e) => !e.undated && e.watchedOn.startsWith(key));
  const stats = computeStats(month);
  const recent = (month.length ? month : entries).filter((e) => e.posterUrl).slice(0, SHOWN);
  const paper = ticketPaper('movie', theme);
  const hours = Math.round(stats.minutes / 60);
  return (
    <Rise style={styles.wrap}>
      <Tap onPress={() => router.navigate('/diary')} scale={0.98} accessibilityRole="button" accessibilityLabel={`${monthName(now)}: ${month.length} logged. Open your diary`} style={[styles.ticket, { backgroundColor: paper.paper, borderColor: paper.border }]}>
        <TicketPrint kind="movie" theme={theme} />
        <View style={styles.stub}>
          <Text maxFontSizeMultiplier={1.15} style={[styles.month, { color: theme.accent }]}>
            {monthName(now).slice(0, 3).toUpperCase()}
          </Text>
          <Text style={[styles.year, { color: theme.textMuted }]}>{now.slice(0, 4)}</Text>
        </View>
        <View style={[styles.tear, { borderLeftColor: paper.border }]}>
          <View style={[styles.notch, styles.notchTop, { backgroundColor: theme.bg, borderColor: paper.border }]} />
          <View style={[styles.notch, styles.notchBottom, { backgroundColor: theme.bg, borderColor: paper.border }]} />
        </View>
        <View style={styles.body}>
          {month.length > 0 ? (
            <View style={styles.numbers}>
              <View>
                <CountUp value={month.length} style={[styles.number, { color: theme.text }]} />
                <Text style={[styles.label, { color: theme.textMuted }]}>{month.length === 1 ? 'title' : 'titles'}</Text>
              </View>
              {hours > 0 && (
                <View>
                  <CountUp value={hours} style={[styles.number, { color: theme.text }]} format={(n) => `${n}h`} />
                  <Text style={[styles.label, { color: theme.textMuted }]}>watched</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={[styles.empty, { color: theme.text }]}>{entries.length ? 'Nothing logged yet this month' : 'Your diary starts here'}</Text>
          )}
          {recent.length > 0 && (
            <View style={styles.posters}>
              {recent.map((e) => (
                <Poster key={e.id} uri={e.posterUrl} title={e.title} width={36} theme={theme} radius={3} />
              ))}
            </View>
          )}
        </View>
      </Tap>
      <Tap onPress={() => router.navigate('/search')} accessibilityRole="button" style={[styles.log, { backgroundColor: theme.accent }]}>
        <Ionicons name="add" size={22} color={theme.accentText} />
        <Text style={[styles.logText, { color: theme.accentText }]}>LOG WHAT YOU WATCHED</Text>
      </Tap>
    </Rise>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  ticket: { flexDirection: 'row', alignItems: 'stretch', minHeight: 132, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  stub: { width: 84, alignItems: 'center', justifyContent: 'center', gap: 2 },
  month: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, letterSpacing: 1, includeFontPadding: false },
  year: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  tear: { width: 1, borderLeftWidth: 1, borderStyle: 'dashed' },
  notch: { position: 'absolute', left: -NOTCH / 2 - 1, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, borderWidth: 1 },
  notchTop: { top: -NOTCH / 2 },
  notchBottom: { bottom: -NOTCH / 2 },
  body: { flex: 1, justifyContent: 'center', gap: 10, padding: 14 },
  numbers: { flexDirection: 'row', gap: 24 },
  number: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, includeFontPadding: false },
  label: { fontSize: font.caption },
  empty: { fontSize: font.body, fontWeight: '600', lineHeight: 22 },
  posters: { flexDirection: 'row', gap: 6 },
  log: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26 },
  logText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
});
