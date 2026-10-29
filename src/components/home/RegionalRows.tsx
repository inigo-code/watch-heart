import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { tmdbKey } from '@/api';
import { discoverTmdb } from '@/api/tmdb';
import type { BrowseQuery } from '@/api/tmdb';
import { browse } from '@/components/discover/DiscoverHome';
import { RowHead, TitleRow } from '@/components/title/Rows';
import { countryName } from '@/lib/discover';
import { INDIAN_LANGUAGES } from '@/lib/regional';
import type { Language } from '@/lib/regional';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import type { Title } from '@/store/types';

const NOW = new Date().getFullYear();


/**
 * Home's rows for where you are. In India: FDFS (new Indian releases), favourites in a language you pick,
 * and hidden gems (your language from Settings leads the chips). Elsewhere, one row of what's popular from your country (none for the US, which Trending
 * already is).
 */
export function RegionalRows({ region, mine, theme, seen }: { region: string; mine: Language | null; theme: Theme; seen: (t: Title) => boolean }) {
  const languages = mine ? [mine, ...INDIAN_LANGUAGES.filter((l) => l.code !== mine.code)] : INDIAN_LANGUAGES;
  const [lang, setLang] = useState(languages[0]);
  if (region === 'IN') {
    const favourites: BrowseQuery = { kind: 'movie', lang: lang.code, sort: 'rating', minVotes: lang.code === 'bn' || lang.code === 'kn' ? 40 : 100 };
    return (
      <>
        <QueryRow
          theme={theme}
          seen={seen}
          title="FDFS · New Indian releases"
          sub="First day, first show: out in the last four weeks"
          q={{ kind: 'movie', country: 'IN', days: [-28, 7] }}
        />
        <QueryRow
          theme={theme}
          seen={seen}
          title="Indian favourites"
          q={favourites}
          name={`${lang.name} favourites`}
          above={
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {languages.map((l) => {
                const on = l.code === lang.code;
                return (
                  <Pressable
                    key={l.code}
                    onPress={() => setLang(l)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, { backgroundColor: on ? theme.accent : theme.chip }]}
                  >
                    <Text style={[styles.chipText, { color: on ? theme.accentText : theme.text }]}>{l.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          }
        />
        <QueryRow
          theme={theme}
          seen={seen}
          title="Indian hidden gems"
          sub="Rated highly, seen by few"
          q={{ kind: 'movie', country: 'IN', sort: 'rating', minScore: 7.3, minVotes: 50, maxVotes: 800, notGenres: ['Documentary', 'Music'] }}
        />
      </>
    );
  }
  if (region === 'US') return null;
  return (
    <QueryRow theme={theme} seen={seen} title={`Popular from ${countryName(region)}`} q={{ kind: 'movie', country: region, from: NOW - 2, minVotes: 20 }} />
  );
}

/** A row of posters from a Discover query, with "See all" opening the full grid. Hidden when nothing matches. */
function QueryRow({
  theme,
  seen,
  title,
  sub,
  q,
  name,
  above,
}: {
  theme: Theme;
  seen: (t: Title) => boolean;
  title: string;
  sub?: string;
  q: BrowseQuery;
  name?: string;
  above?: React.ReactNode;
}) {
  const tmdb = tmdbKey(useSettings().settings.tmdbKey);
  const key = JSON.stringify(q);
  const [result, setResult] = useState<{ key: string; titles: Title[] } | null>(null);
  useEffect(() => {
    let live = true;
    if (!tmdb) return;
    discoverTmdb(tmdb, q, 1)
      .then((r) => live && setResult({ key, titles: r.results.filter((t) => t.posterUrl) }))
      .catch(() => live && setResult({ key, titles: [] }));
    return () => {
      live = false;
    };
    // The query is compared by its JSON (\`key\`), not by identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tmdb]);
  const titles = result?.key === key ? result.titles : null;
  if (titles && !titles.length && !above) return null;
  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <RowHead title={title} theme={theme} more="See all" onMore={() => browse(q, name ?? title)} />
        {!!sub && <Text style={[styles.sub, { color: theme.textMuted }]}>{sub}</Text>}
      </View>
      {above}
      {titles === null ? (
        <View style={styles.skeleton}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.ghost, { backgroundColor: theme.card }]} />
          ))}
        </View>
      ) : titles.length ? (
        <TitleRow titles={titles} theme={theme} seen={seen} />
      ) : (
        <Text style={[styles.sub, { color: theme.textMuted }]}>Nothing here yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  head: { gap: 4 },
  sub: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17 },
  chips: { gap: 8, paddingRight: 16 },
  chip: { borderRadius: 16, paddingHorizontal: 14, height: 32, justifyContent: 'center' },
  chipText: { fontSize: font.footnote, fontWeight: '600' },
  skeleton: { flexDirection: 'row', gap: 12 },
  ghost: { width: 104, height: 156, borderRadius: 6 },
});
