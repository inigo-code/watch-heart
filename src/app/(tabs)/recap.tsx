import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/Film';
import { RatingChart } from '@/components/RatingChart';
import { SectionLabel } from '@/components/SectionLabel';
import { Segmented } from '@/components/SettingsUI';
import { formatRuntime, monthKey, monthName, today } from '@/lib/dates';
import { computeStats } from '@/lib/stats';
import type { Stats } from '@/lib/stats';
import { KIND_COLORS, font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import { LAYOUTS } from '@/story/palettes';
import { StoryCanvas } from '@/story/StoryCanvas';
import type { StoryHandle, StoryOptions } from '@/story/StoryCanvas';
import { PalettePicker, ShareButtons, StoryPreview } from '@/story/Studio';

/** A period is a month ("2026-10") or a whole year ("2026"). */
const isYear = (period: string) => period.length === 4;

export default function RecapScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Imports without a watch date can't belong to a month, so recaps leave them out.
  const { entries: all } = useDiary();
  const entries = useMemo(() => all.filter((e) => !e.undated), [all]);
  const { settings, update } = useSettings();
  const params = useLocalSearchParams<{ period?: string }>();
  const storyRef = useRef<StoryHandle>(null);
  const [ready, setReady] = useState(false);
  const onReady = useCallback((r: boolean) => setReady(r), []);

  const periods = useMemo(() => {
    const months = [...new Set(entries.map((e) => monthKey(e.watchedOn)))].sort().reverse();
    const years = [...new Set(months.map((m) => m.slice(0, 4)))];
    return { months, years };
  }, [entries]);

  const [period, setPeriod] = useState(() => params.period ?? periods.months[0] ?? monthKey(today()));
  // Opening the tab from a month's STORY button picks that month (adjusting state while rendering,
  // as React recommends, rather than in an effect).
  const [lastParam, setLastParam] = useState(params.period);
  if (params.period !== lastParam) {
    setLastParam(params.period);
    if (params.period) setPeriod(params.period);
  }

  const chosen = useMemo(() => entries.filter((e) => e.watchedOn.startsWith(period)), [entries, period]);
  const stats = useMemo(() => computeStats(chosen), [chosen]);
  const options = settings.story;
  const setOptions = (patch: Partial<StoryOptions>) => update({ story: { ...options, ...patch } });

  const title = isYear(period) ? period : monthName(period).toUpperCase();
  const subtitle = isYear(period) ? 'YEAR IN REVIEW' : period.slice(0, 4);
  const previewWidth = Math.min(width - 32, 300);

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 32 }]}>
      <View>
        <Text style={[styles.heading, { color: theme.text }]}>
          THE <Text style={{ color: theme.accent }}>RECAP</Text>
        </Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>Turn a month, or a whole year, into a story.</Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="filmstrip-box-multiple" size={48} color={theme.accent} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>NOTHING ON THE REEL YET</Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>Log a few titles and your monthly recap appears here, ready for Instagram.</Text>
          <Pressable onPress={() => router.navigate('/search')} style={[styles.emptyBtn, { backgroundColor: theme.accent }]} accessibilityRole="button">
            <Text style={[styles.emptyBtnText, { color: theme.accentText }]}>FIND A TITLE</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periods}>
            {periods.months.map((m) => (
              <Chip key={m} theme={theme} label={`${monthName(m).slice(0, 3)} ’${m.slice(2, 4)}`} active={period === m} onPress={() => setPeriod(m)} />
            ))}
            {periods.years.map((y) => (
              <Chip key={y} theme={theme} icon="trophy-outline" label={`${y} wrapped`} active={period === y} onPress={() => setPeriod(y)} />
            ))}
          </ScrollView>

          {chosen.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>Nothing logged in {isYear(period) ? period : monthName(period)}.</Text>
          ) : (
            <>
              <StoryPreview width={previewWidth} theme={theme}>
                <StoryCanvas ref={storyRef} entries={chosen} title={title} subtitle={subtitle} options={options} onReady={onReady} />
              </StoryPreview>

              <ShareButtons target={storyRef} ready={ready} theme={theme} />

              <View style={styles.controls}>
                <Label theme={theme}>Layout</Label>
                <Segmented theme={theme} value={options.layout} onChange={(layout) => setOptions({ layout })} options={LAYOUTS} />
                <Label theme={theme}>Palette</Label>
                <PalettePicker value={options.palette} onChange={(palette) => setOptions({ palette })} theme={theme} />
                <Label theme={theme}>Show</Label>
                <View style={styles.toggles}>
                  <Chip theme={theme} icon="star" label="Ratings" active={options.ratings} onPress={() => setOptions({ ratings: !options.ratings })} />
                  <Chip theme={theme} icon="stats-chart" label="Stats" active={options.stats} onPress={() => setOptions({ stats: !options.stats })} />
                  <Chip theme={theme} icon="podium-outline" label="Rank by rating" active={options.ranked} onPress={() => setOptions({ ranked: !options.ranked })} />
                </View>
              </View>

              <Numbers theme={theme} stats={stats} />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Label({ theme, children }: { theme: Theme; children: string }) {
  return <SectionLabel theme={theme}>{children}</SectionLabel>;
}

/** The period in numbers: tiles, the mix of films/series/anime, and how you rated. */
function Numbers({ theme, stats }: { theme: Theme; stats: Stats }) {
  const tiles = [
    { value: String(stats.total), label: 'Titles' },
    { value: stats.minutes ? formatRuntime(stats.minutes) : '—', label: 'Screen time' },
    { value: stats.avgStars ? `${stats.avgStars}★` : '—', label: 'Avg rating' },
    { value: String(stats.liked), label: 'Loved' },
    { value: String(stats.rewatches), label: 'Rewatches' },
    { value: String(stats.reviews), label: 'Reviews' },
  ];
  return (
    <View style={styles.numbers}>
      <Label theme={theme}>The numbers</Label>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={[styles.tile, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.tileValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {t.value}
            </Text>
            <Text style={[styles.tileLabel, { color: theme.accent }]}>{t.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <View style={styles.mix}>
        {(['movie', 'tv', 'anime'] as const).map((k) =>
          stats.byKind[k] ? <View key={k} style={{ flex: stats.byKind[k], backgroundColor: KIND_COLORS[k] }} /> : null,
        )}
      </View>
      <View style={styles.mixLegend}>
        {(['movie', 'tv', 'anime'] as const).map((k) => (
          <Text key={k} style={[styles.mixText, { color: theme.textMuted }]}>
            <Text style={{ color: KIND_COLORS[k] }}>■ </Text>
            {stats.byKind[k]} {k === 'movie' ? 'FILMS' : k === 'tv' ? 'SERIES' : 'ANIME'}
          </Text>
        ))}
      </View>

      <Label theme={theme}>Your ratings</Label>
      <RatingChart ratings={stats.ratings} theme={theme} height={56} />

      {(stats.topGenre || stats.favourite || stats.topVibe) && (
        <View style={[styles.facts, { borderColor: theme.border }]}>
          {stats.topGenre && (
            <Text style={[styles.fact, { color: theme.textMuted }]}>
              TOP GENRE <Text style={{ color: theme.text }}>{stats.topGenre.toUpperCase()}</Text>
            </Text>
          )}
          {stats.topVibe && (
            <Text style={[styles.fact, { color: theme.textMuted }]}>
              TOP VIBE <Text style={{ color: theme.text }}>{stats.topVibe.toUpperCase()}</Text>
            </Text>
          )}
          {stats.favourite && (
            <Text style={[styles.fact, { color: theme.textMuted }]} numberOfLines={1}>
              FAVOURITE <Text style={{ color: theme.text }}>{stats.favourite.title.toUpperCase()}</Text>
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 18 },
  heading: { fontFamily: fonts.display, fontSize: font.marquee, lineHeight: 46, letterSpacing: 1, includeFontPadding: false },
  sub: { fontFamily: fonts.mono, fontSize: font.footnote },
  periods: { gap: 8 },
  controls: { gap: 10 },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: fonts.display, fontSize: 28, letterSpacing: 1, textAlign: 'center' },
  emptyText: { fontFamily: fonts.mono, fontSize: font.body, textAlign: 'center', lineHeight: 21 },
  emptyBtn: { height: 44, paddingHorizontal: 20, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  emptyBtnText: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1 },
  numbers: { gap: 10 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.5%', flexGrow: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  tileValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, includeFontPadding: false },
  tileLabel: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 1.2 },
  mix: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  mixLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  mixText: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1 },
  facts: { borderTopWidth: 1, paddingTop: 10, gap: 6 },
  fact: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
});
