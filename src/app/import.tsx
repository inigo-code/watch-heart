import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImportLogo, logoFor } from '@/components/ImportLogo';
import type { LogoKey } from '@/components/ImportLogo';
import { SectionLabel } from '@/components/SectionLabel';
import { useToast } from '@/components/Toast';
import { tmdbKey } from '@/api';
import { pickImport } from '@/lib/import';
import type { ImportBundle } from '@/lib/import';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { findPostersNow, useUpkeepProgress } from '@/lib/tmdbFreshness';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';

// Bring your history from other apps: pick whatever they exported, check what was found, add it.

type Guide = { app: string; logos: LogoKey[]; what: string; steps: string };

const GUIDES: Guide[] = [
  {
    app: 'Letterboxd',
    logos: ['letterboxd'],
    what: 'Diary, watched and rated films, reviews, likes, watchlist',
    steps: 'letterboxd.com → Settings → Data → Export your data. Pick the .zip as it is.',
  },
  {
    app: 'IMDb',
    logos: ['imdb'],
    what: 'Ratings (dated when you rated) and watchlist',
    steps: 'imdb.com → Your ratings → ⋯ → Export, and the same on Your watchlist. Pick both CSVs.',
  },
  {
    app: 'Trakt',
    logos: ['trakt'],
    what: 'Watch history, ratings, watchlist, with exact matches',
    steps: 'trakt.tv → Settings → Data → Export your data. Pick the .zip.',
  },
  {
    app: 'Moviebase',
    logos: ['moviebase', 'trakt'],
    what: 'Through Trakt',
    steps: 'Moviebase syncs with Trakt: sync it, then export from Trakt as above.',
  },
  {
    app: 'MyAnimeList / AniList',
    logos: ['myanimelist', 'anilist'],
    what: 'Anime list: completed, watching, dropped, plan to watch',
    steps: 'myanimelist.net → profile menu → Export → Anime list (.xml.gz). AniList: export your list in MyAnimeList format.',
  },
  {
    app: 'Netflix',
    logos: ['netflix'],
    what: 'Viewing history; episodes of a show on one day become one entry',
    steps: 'netflix.com → Account → Profiles → your profile → Viewing activity → Download all. Or the full data download (.zip).',
  },
  {
    app: 'Refract',
    logos: ['refract'],
    what: 'Watched titles, ratings, reviews, watchlist',
    steps: 'In Refract: Settings → Export Data. Save the .zip and pick it here.',
  },
  {
    app: 'Serializd, TV Time and others',
    logos: ['serializd', 'tvtime'],
    what: 'Any CSV or JSON export with titles and dates',
    steps: 'Columns like title, date, rating, review, season and episode are recognised by name. TV Time: the GDPR export (tracking-prod-records-v2.csv), if you saved it.',
  },
];

export default function ImportScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { settings } = useSettings();
  const diary = useDiary();
  const posters = useUpkeepProgress();
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<ImportBundle | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const choose = async () => {
    setBusy(true);
    setDone(null);
    try {
      const bundle = await pickImport();
      if (bundle) setFound(bundle);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    if (!found) return;
    const r = diary.importEntries(found.entries);
    const queued = diary.importWatchlist(found.watchlist);
    const undated = found.entries.filter((e) => e.undated).length;
    const parts = [
      `${r.added} added to your diary`,
      queued ? `${queued} to your watchlist` : '',
      r.updated ? `${r.updated} updated` : '',
      r.skipped ? `${r.skipped} were already here` : '',
      undated ? `${undated} without a watch date are in the Archive` : '',
    ].filter(Boolean);
    setDone(parts.join(' · '));
    setFound(null);
  };

  const key = tmdbKey(settings.tmdbKey);
  const total = found ? found.entries.length + found.watchlist.length : 0;

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <View>
        <Text style={[styles.heading, { color: theme.text }]}>
          BRING YOUR <Text style={{ color: theme.accent }}>HISTORY</Text>
        </Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>
          Pick what your other app exported: a .zip as it comes, CSVs, JSON or a MyAnimeList list. You can pick several at once.
        </Text>
      </View>

      <Pressable
        onPress={choose}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primary, { backgroundColor: theme.accent, opacity: busy ? 0.6 : pressed ? 0.85 : 1 }]}
      >
        {busy ? <ActivityIndicator color={theme.accentText} /> : <MaterialCommunityIcons name="folder-open-outline" size={22} color={theme.accentText} />}
        <Text style={[styles.primaryText, { color: theme.accentText }]}>{busy ? 'READING…' : 'CHOOSE FILES'}</Text>
      </Pressable>

      {found && (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.accent + '66' }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{total ? 'READY TO IMPORT' : 'NOTHING FOUND'}</Text>
          {found.sources.map((s) => {
            const logo = logoFor(s.source);
            return (
              <View key={s.source} style={styles.sourceRow}>
                {logo ? <ImportLogo logos={[logo]} size={32} /> : <Ionicons name="checkmark-circle" size={18} color={theme.accent} />}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sourceName, { color: theme.text }]}>{s.source}</Text>
                  <Text style={[styles.meta, { color: theme.textMuted }]}>
                    {[s.entries ? `${s.entries} in the diary` : '', s.watchlist ? `${s.watchlist} on the watchlist` : ''].filter(Boolean).join(' · ')}
                  </Text>
                  {!!s.note && <Text style={[styles.meta, { color: theme.textMuted }]}>{s.note}</Text>}
                </View>
              </View>
            );
          })}
          {found.unreadable.length > 0 && (
            <Text style={[styles.meta, { color: theme.textMuted }]}>Not recognised, so left out: {found.unreadable.join(', ')}</Text>
          )}
          {total > 0 && (
            <Pressable onPress={add} accessibilityRole="button" style={({ pressed }) => [styles.primary, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}>
              <MaterialCommunityIcons name="movie-open-check-outline" size={20} color={theme.accentText} />
              <Text style={[styles.primaryText, { color: theme.accentText }]}>ADD {total} TO WATCH HEART</Text>
            </Pressable>
          )}
          <Text style={[styles.meta, { color: theme.textMuted }]}>Importing again later adds only what’s new; nothing is duplicated or deleted.</Text>
        </View>
      )}

      {done && (
        <View style={[styles.card, { backgroundColor: theme.accentSoft, borderColor: theme.accent + '66' }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>IMPORTED</Text>
          <Text style={[styles.meta, { color: theme.text }]}>{done}</Text>
          <Pressable onPress={() => router.dismissTo('/')} accessibilityRole="button">
            <Text style={[styles.link, { color: theme.accent }]}>OPEN THE DIARY →</Text>
          </Pressable>
        </View>
      )}

      <PosterStatus theme={theme} haveKey={!!key} running={posters.running} doneCount={posters.done} total={posters.total} foundCount={posters.found} />

      <SectionLabel theme={theme}>HOW TO EXPORT</SectionLabel>
      {GUIDES.map((g) => {
        const expanded = open === g.app;
        return (
          <Pressable
            key={g.app}
            onPress={() => {
              LayoutAnimation.easeInEaseOut();
              setOpen(expanded ? null : g.app);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            style={[styles.guide, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <View style={styles.guideHead}>
              <ImportLogo logos={g.logos} ring={theme.card} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sourceName, { color: theme.text }]}>{g.app}</Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>{g.what}</Text>
              </View>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
            </View>
            {expanded && <Text style={[styles.steps, { color: theme.text }]}>{g.steps}</Text>}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PosterStatus({ theme, haveKey, running, doneCount, total, foundCount }: {
  theme: Theme;
  haveKey: boolean;
  running: boolean;
  doneCount: number;
  total: number;
  foundCount: number;
}) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.sourceRow}>
        <MaterialCommunityIcons name="image-filter-hdr" size={20} color={theme.accent} />
        <Text style={[styles.sourceName, { color: theme.text, flex: 1 }]}>Posters and details</Text>
        {running && <ActivityIndicator color={theme.accent} />}
      </View>
      <Text style={[styles.meta, { color: theme.textMuted }]}>
        {!haveKey
          ? 'Add a TMDB key in Settings and posters are found automatically.'
          : running
            ? `Finding posters in the background: ${doneCount} of ${total} checked, ${foundCount} found. You can leave this screen.`
            : 'Found automatically after every import, from TMDB. Titles it can’t find are tried again in two weeks.'}
      </Text>
      {haveKey && !running && (
        <Pressable onPress={findPostersNow} accessibilityRole="button">
          <Text style={[styles.link, { color: theme.accent }]}>LOOK AGAIN NOW →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  heading: { fontFamily: fonts.display, fontSize: font.marquee, lineHeight: 46, letterSpacing: 1, includeFontPadding: false },
  sub: { fontFamily: fonts.mono, fontSize: font.footnote, lineHeight: 19, marginTop: 4 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 26 },
  primaryText: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1.5 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { fontFamily: fonts.display, fontSize: 24, letterSpacing: 1 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceName: { fontSize: font.body, fontWeight: '700' },
  meta: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17 },
  link: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
  guide: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 8 },
  guideHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  steps: { fontFamily: fonts.mono, fontSize: font.footnote, lineHeight: 19 },
});
