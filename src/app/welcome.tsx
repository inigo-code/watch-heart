import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tmdbKey } from '@/api';
import { watchRegion } from '@/api/omdb';
import { discoverTmdb, trendingAllTmdb } from '@/api/tmdb';
import { ActionSheet } from '@/components/ActionSheet';
import { Text, TextInput } from '@/components/AppText';
import { BrandTitle } from '@/components/BrandTitle';
import { Chip, Poster } from '@/components/Film';
import { KeyboardSafe } from '@/components/KeyboardSafe';
import { Pop, Rise, Tap, useReducedMotion } from '@/components/Motion';
import { COUNTRIES, countryName, flag } from '@/lib/discover';
import { blankDraft } from '@/lib/entryDraft';
import { homeLanguage, languagesFor, regionalFeatured } from '@/lib/regional';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Title } from '@/store/types';

const STEPS = 3;
const GAP = 8;
const COLS = 3;

/** Open the app proper, wherever onboarding was left from. */
const leave = (then?: '/import' | '/account') => {
  router.replace('/');
  if (then) router.push(then);
};

/**
 * The first run, three short steps to a Home that already knows you: what the app is, who you are and where
 * (which sets Home's first cards), and a tap on what you've seen (which fills the Diary and starts the
 * recommendations). Everything can be skipped. It never shows to anyone who already has a diary.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const { addEntry } = useDiary();
  const [step, setStep] = useState(0);
  const [titles, setTitles] = useState<Title[] | null>(null);
  const [picked, setPicked] = useState<Title[]>([]);
  const key = tmdbKey(settings.tmdbKey);
  const region = watchRegion(settings.watchRegion);
  const lang = homeLanguage(region, settings.homeLanguage);

  // What's on now, with your country's own films first once you've said where you are.
  const regional = regionalFeatured(region, lang);
  const regionalKey = regional ? JSON.stringify(regional.q) : '';
  useEffect(() => {
    if (!key) return;
    let live = true;
    Promise.all([
      regional ? discoverTmdb(key, { ...regional.q, days: undefined, minVotes: 200, sort: 'popular' }, 1).catch(() => ({ results: [] as Title[] })) : { results: [] as Title[] },
      trendingAllTmdb(key).catch(() => [] as Title[]),
    ]).then(([local, trending]) => {
      if (!live) return;
      const seen = new Set<string>();
      setTitles(
        [...local.results.slice(0, 9), ...trending].filter((t) => {
          if (!t.posterUrl || seen.has(t.sourceId)) return false;
          seen.add(t.sourceId);
          return true;
        }),
      );
    });
    return () => {
      live = false;
    };
    // The query is compared by its JSON (`regionalKey`), not by identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, regionalKey]);

  const finish = (then?: '/import' | '/account') => {
    for (const t of picked) addEntry({ ...blankDraft(t), undated: true, liked: true });
    update({ onboarded: true });
    leave(then);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
      {step === 0 ? (
        <Intro theme={theme} posters={titles} bottom={insets.bottom} onStart={() => setStep(1)} onSignIn={() => finish('/account')} />
      ) : (
        <KeyboardSafe style={{ flex: 1 }}>
          <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
            <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${STEPS}`}>
              {Array.from({ length: STEPS }, (_, i) => (
                <View key={i} style={[styles.dash, { backgroundColor: i <= step ? theme.accent : theme.border }]} />
              ))}
            </View>
            <Pressable onPress={() => finish()} hitSlop={12} accessibilityRole="button">
              <Text style={[styles.skip, { color: theme.textMuted }]}>SKIP</Text>
            </Pressable>
          </View>
          {step === 1 ? (
            <You theme={theme} onNext={() => setStep(2)} bottom={insets.bottom} />
          ) : (
            <Seen theme={theme} titles={titles} picked={picked} setPicked={setPicked} bottom={insets.bottom} onDone={finish} />
          )}
        </KeyboardSafe>
      )}
    </View>
  );
}

/** One column of the poster wall, drifting slowly. */
function WallColumn({ posters, theme, width, up, offset }: { posters: Title[]; theme: Theme; width: number; up: boolean; offset: number }) {
  const reduced = useReducedMotion();
  const [drift] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const run = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 46000, easing: Easing.linear, useNativeDriver: true }));
    run.start();
    return () => run.stop();
  }, [drift, reduced]);
  const span = posters.length * (width * 1.5 + GAP);
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: up ? [-offset, -offset - span] : [-offset - span, -offset] });
  return (
    <Animated.View style={{ gap: GAP, transform: [{ translateY }] }}>
      {[...posters, ...posters, ...posters].map((t, i) => (
        <Poster key={`${t.sourceId}:${i}`} uri={t.posterUrl} title={t.title} width={width} theme={theme} radius={6} />
      ))}
    </Animated.View>
  );
}

/** What this is: real posters from this week, the name, one line, one button. */
function Intro({ theme, posters, bottom, onStart, onSignIn }: { theme: Theme; posters: Title[] | null; bottom: number; onStart: () => void; onSignIn: () => void }) {
  const { width } = useWindowDimensions();
  const tile = (width - GAP * (COLS + 1)) / COLS;
  const columns = useMemo(() => {
    if (!posters?.length) return [];
    return [0, 1, 2].map((c) => posters.filter((_, i) => i % COLS === c).slice(0, 6));
  }, [posters]);
  return (
    <View style={styles.screen}>
      <View style={styles.wall} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {columns.map((c, i) => (
          <Rise key={i} order={i}>
            <WallColumn posters={c} theme={theme} width={tile} up={i !== 1} offset={i * 40} />
          </Rise>
        ))}
      </View>
      <LinearGradient colors={[theme.bg + '00', theme.bg + 'CC', theme.bg]} locations={[0, 0.5, 0.74]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.introBody, { paddingBottom: bottom + 24 }]}>
        <Rise order={1}>
          <BrandTitle theme={theme} size={34} />
        </Rise>
        <Rise order={2}>
          <Text maxFontSizeMultiplier={1.15} accessibilityRole="header" style={[styles.headline, { color: theme.text }]}>
            EVERY FILM YOU WATCH, KEPT LIKE A TICKET
          </Text>
        </Rise>
        <Rise order={3}>
          <Text style={[styles.lead, { color: theme.textMuted }]}>A diary for films, series and anime</Text>
        </Rise>
        <Rise order={4} style={styles.actions}>
          <Primary theme={theme} label="START YOUR DIARY" onPress={onStart} />
          <Pressable onPress={onSignIn} hitSlop={8} accessibilityRole="button" style={styles.secondary}>
            <Text style={[styles.secondaryText, { color: theme.text }]}>I already have an account</Text>
          </Pressable>
        </Rise>
      </View>
    </View>
  );
}

/** Name, country and language: Home's first cards follow from these. */
function You({ theme, onNext, bottom }: { theme: Theme; onNext: () => void; bottom: number }) {
  const { settings, update } = useSettings();
  const [name, setName] = useState(settings.name);
  const [picking, setPicking] = useState(false);
  const region = watchRegion(settings.watchRegion);
  const phone = watchRegion('');
  const languages = languagesFor(region);
  return (
    <>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Rise>
          <Text maxFontSizeMultiplier={1.15} accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
            WHAT SHOULD WE CALL YOU?
          </Text>
        </Rise>
        <Rise order={1}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={theme.textMuted}
            maxLength={30}
            returnKeyType="done"
            accessibilityLabel="Your name"
            style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
          />
        </Rise>
        <Rise order={2} style={styles.block}>
          <Text style={[styles.label, { color: theme.accent }]}>WHERE YOU WATCH</Text>
          <Text style={[styles.lead, { color: theme.textMuted }]}>For new releases and where to watch</Text>
          <Tap onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={`Country: ${countryName(region)}. Change`} style={[styles.country, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={styles.flag}>{flag(region)}</Text>
            <Text style={[styles.countryName, { color: theme.text }]}>{countryName(region)}</Text>
            <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
          </Tap>
        </Rise>
        {languages.length > 0 && (
          <Rise order={3} style={styles.block}>
            <Text style={[styles.label, { color: theme.accent }]}>YOUR LANGUAGE</Text>
            <View style={styles.chips}>
              <Chip theme={theme} label="Any" active={!languages.some((l) => l.code === settings.homeLanguage)} onPress={() => update({ homeLanguage: '' })} />
              {languages.map((l) => (
                <Chip key={l.code} theme={theme} label={l.name} active={settings.homeLanguage === l.code} onPress={() => update({ homeLanguage: l.code })} />
              ))}
            </View>
          </Rise>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: bottom + 16 }]}>
        <Primary
          theme={theme}
          label="CONTINUE"
          onPress={() => {
            if (name.trim() !== settings.name) update({ name: name.trim() });
            onNext();
          }}
        />
      </View>
      <ActionSheet
        visible={picking}
        title="Your country"
        onClose={() => setPicking(false)}
        actions={[...new Set([region, phone, ...COUNTRIES])]
          .sort((a, b) => countryName(a).localeCompare(countryName(b)))
          .map((c) => ({
            label: `${countryName(c)}${c === region ? '  ✓' : ''}`,
            leading: <Text style={styles.flag}>{flag(c)}</Text>,
            onPress: () => update({ watchRegion: c }),
          }))}
      />
    </>
  );
}

/** One poster to tick. */
function Pick({ t, width, theme, on, onPress }: { t: Title; width: number; theme: Theme; on: boolean; onPress: () => void }) {
  return (
    <Tap onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${t.title}${t.year ? `, ${t.year}` : ''}`} style={{ width }}>
      <Pop when={on}>
        <Poster uri={t.posterUrl} title={t.title} width={width} theme={theme} radius={6} style={on ? { borderWidth: 2, borderColor: theme.accent } : undefined} />
        {on && (
          <View style={[styles.tick, { backgroundColor: theme.accent }]}>
            <Ionicons name="heart" size={14} color={theme.accentText} />
          </View>
        )}
      </Pop>
    </Tap>
  );
}

/** Tap what you've seen: a diary that isn't empty, and recommendations from the first minute. */
function Seen({ theme, titles, picked, setPicked, bottom, onDone }: { theme: Theme; titles: Title[] | null; picked: Title[]; setPicked: Dispatch<SetStateAction<Title[]>>; bottom: number; onDone: (then?: '/import') => void }) {
  const { width } = useWindowDimensions();
  const tile = (width - 32 - GAP * (COLS - 1)) / COLS;
  const n = picked.length;
  const toggle = (t: Title) => setPicked((list) => (list.some((p) => p.sourceId === t.sourceId) ? list.filter((p) => p.sourceId !== t.sourceId) : [...list, t]));
  return (
    <>
      <ScrollView contentContainerStyle={styles.body}>
        <Rise>
          <Text maxFontSizeMultiplier={1.15} accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
            TAP WHAT YOU’VE LOVED
          </Text>
        </Rise>
        <Rise order={1}>
          <Text style={[styles.lead, { color: theme.textMuted }]}>Home learns your taste from these</Text>
        </Rise>
        <View style={styles.grid}>
          {(titles ?? []).slice(0, 18).map((t, i) => (
            <Rise key={t.sourceId} order={i}>
              <Pick t={t} width={tile} theme={theme} on={picked.some((p) => p.sourceId === t.sourceId)} onPress={() => toggle(t)} />
            </Rise>
          ))}
        </View>
        {titles && !titles.length && <Text style={[styles.lead, { color: theme.textMuted }]}>Posters couldn’t load just now. You can add titles from Find once you’re online.</Text>}
        <Pressable onPress={() => onDone('/import')} accessibilityRole="button" style={styles.secondary}>
          <Text style={[styles.secondaryText, { color: theme.text }]}>Bring your history from Letterboxd, Trakt or MyAnimeList</Text>
        </Pressable>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: bottom + 16 }]}>
        <Primary theme={theme} label={n ? `ADD ${n} TO MY DIARY` : 'OPEN WATCH HEART'} onPress={() => onDone()} />
      </View>
    </>
  );
}

function Primary({ theme, label, onPress }: { theme: Theme; label: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} accessibilityRole="button" style={[styles.primary, { backgroundColor: theme.accent }]}>
      <Text style={[styles.primaryText, { color: theme.accentText }]} numberOfLines={1}>
        {label}
      </Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  wall: { ...StyleSheet.absoluteFill, flexDirection: 'row', justifyContent: 'center', gap: GAP },
  introBody: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, gap: 12 },
  headline: { fontFamily: fonts.display, fontSize: font.marquee, lineHeight: 46, letterSpacing: 1, includeFontPadding: false },
  lead: { fontSize: font.body, lineHeight: 22 },
  actions: { gap: 4, marginTop: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingBottom: 8 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  dash: { flex: 1, height: 4, borderRadius: 2 },
  skip: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
  body: { padding: 16, gap: 16 },
  heading: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, letterSpacing: 1, includeFontPadding: false },
  block: { gap: 8 },
  label: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1.5, marginTop: 8 },
  input: { height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: font.body },
  country: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16 },
  flag: { fontSize: 20 },
  countryName: { flex: 1, fontSize: font.body, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tick: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  primary: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1.2 },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  secondaryText: { fontSize: font.footnote, fontWeight: '600', textAlign: 'center', textDecorationLine: 'underline' },
});
