import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { tmdbKey } from '@/api';
import { trackable } from '@/api/episodes';
import { aboutTmdb, madeBy } from '@/api/tmdb';
import type { TitleAbout } from '@/api/tmdb';
import { PeopleRow, RowHead, TitleRow } from '@/components/title/Rows';
import { font, fonts } from '@/lib/theme';
import { easeNextLayout } from '@/lib/motion';
import type { Theme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Title } from '@/store/types';

// What TMDB knows about a title, shared by the title page and diary entries: the synopsis, cast and crew,
// seasons, and what to watch next.

/** Fetches a TMDB title's details, cast and recommendations; null for anything that isn't from TMDB. */
export function useAbout(id: string | null): { about: TitleAbout | null; error: string | null } {
  const key = tmdbKey(useSettings().settings.tmdbKey);
  const [result, setResult] = useState<{ id: string; about: TitleAbout | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!key || !id) return;
    const controller = new AbortController();
    aboutTmdb(key, id, controller.signal)
      .then((about) => setResult({ id, about, error: null }))
      .catch((e) => {
        if (controller.signal.aborted) return;
        setResult({ id, about: null, error: e instanceof Error && e.message !== 'Network request failed' ? e.message : 'No connection.' });
      });
    return () => controller.abort();
  }, [key, id]);

  return result?.id === id ? { about: result.about, error: result.error } : { about: null, error: null };
}

/** The tagline and synopsis (folded to four lines), and for series, whether it's still running. */
export function Synopsis({
  about,
  overview,
  theme,
  label,
  onMore,
}: {
  about: TitleAbout | null;
  overview: string;
  theme: Theme;
  label?: string;
  onMore?: () => void;
}) {
  const [more, setMore] = useState(false);
  const text = about?.overview || overview;
  const series = !!about && about.seasons.length > 0;
  // TMDB sometimes has a tagline run together ("LoveHateDreamsLifeWork…"): a long one with no spaces is skipped.
  const tagline = about?.tagline && (/\s/.test(about.tagline.trim()) || about.tagline.length <= 18) ? about.tagline : null;
  if (!text && !tagline) return null;
  return (
    <View style={styles.block}>
      {label && <RowHead title={label} theme={theme} more="Title page" onMore={onMore} />}
      {!!tagline && <Text style={[styles.tagline, { color: theme.textMuted }]}>“{tagline}”</Text>}
      {!!text && (
        <Pressable
          onPress={() => {
            easeNextLayout();
            setMore((m) => !m);
          }}
          accessibilityRole="button"
          accessibilityHint={more ? 'Shows less' : 'Shows the whole synopsis'}
        >
          <Text style={[styles.overview, { color: theme.text }]} numberOfLines={more ? undefined : 4}>
            {text}
          </Text>
          {text.length > 220 && <Text style={[styles.showMore, { color: theme.accent }]}>{more ? 'SHOW LESS' : 'SHOW MORE'}</Text>}
        </Pressable>
      )}
      {series && about && (
        <Text style={[styles.facts, { color: theme.textMuted }]}>
          {[
            about.status,
            `${about.seasons.length} ${about.seasons.length === 1 ? 'season' : 'seasons'}`,
            about.title.episodes ? `${about.title.episodes} episodes` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      )}
    </View>
  );
}

/** Cast and crew, seasons, "You might like", and the director's (or creator's) other work. */
export function TitleMore({ id, t, about, theme }: { id: string; t: Title; about: TitleAbout; theme: Theme }) {
  const key = tmdbKey(useSettings().settings.tmdbKey);
  const { viewingsOf } = useDiary();
  const [crewTab, setCrewTab] = useState(false);
  const [byMaker, setByMaker] = useState<{ id: string; titles: Title[] } | null>(null);
  const series = id.startsWith('tv:');
  const maker = about.makers[0];
  const seen = (x: Title) => viewingsOf(x.source, x.sourceId).length > 0;
  const people = crewTab ? about.crew : about.cast;
  const episodes = trackable(t) ? () => router.push({ pathname: '/track', params: { title: JSON.stringify(t) } }) : undefined;

  useEffect(() => {
    if (!key || !maker) return;
    const controller = new AbortController();
    madeBy(key, maker.id, series ? 'tv' : 'movie', id, controller.signal)
      .then((titles) => setByMaker({ id, titles }))
      .catch(() => {});
    return () => controller.abort();
  }, [key, maker, id, series]);

  return (
    <>
      {about.cast.length + about.crew.length > 0 && (
        <View style={styles.block}>
          <RowHead title="Cast & crew" theme={theme} onMore={() => router.push({ pathname: '/credits/[id]', params: { id } })} more="Full list" />
          <View style={styles.tabs}>
            {[
              { crew: false, label: 'Cast', n: about.cast.length },
              { crew: true, label: 'Crew', n: about.crew.length },
            ].map((tab) => {
              const on = crewTab === tab.crew;
              return (
                <Pressable
                  key={tab.label}
                  disabled={!tab.n}
                  onPress={() => setCrewTab(tab.crew)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.tab,
                    { borderColor: on ? theme.accent : theme.border, backgroundColor: on ? theme.accent : 'transparent', opacity: tab.n ? 1 : 0.4 },
                  ]}
                >
                  <Text style={[styles.tabText, { color: on ? theme.accentText : theme.text }]}>{tab.label.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
          <PeopleRow people={people.slice(0, 15)} theme={theme} />
        </View>
      )}

      {series && about.seasons.length > 0 && (
        <View style={styles.block}>
          <RowHead title={`Seasons (${about.seasons.length})`} theme={theme} more="Episodes" onMore={episodes} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasons}>
            {about.seasons.map((s) => (
              <View key={s.n} style={styles.season}>
                {s.poster ? (
                  <Image source={{ uri: s.poster }} style={[styles.seasonPoster, { backgroundColor: theme.elevated }]} contentFit="cover" />
                ) : (
                  <View style={[styles.seasonPoster, styles.center, { backgroundColor: theme.elevated }]}>
                    <Text style={[styles.seasonNo, { color: theme.textMuted }]}>{s.n}</Text>
                  </View>
                )}
                <Text style={[styles.seasonName, { color: theme.text }]} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={[styles.seasonSub, { color: theme.textMuted }]}>
                  {s.episodes} eps{s.year ? ` · ${s.year}` : ''}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {about.recommendations.length > 0 && (
        <View style={styles.block}>
          <RowHead title="You might like" theme={theme} />
          <TitleRow titles={about.recommendations} theme={theme} seen={seen} />
        </View>
      )}

      {maker && byMaker?.id === id && byMaker.titles.length > 0 && (
        <View style={styles.block}>
          <RowHead
            title={series ? `More from ${maker.name}` : 'By the same director'}
            theme={theme}
            more={series ? undefined : maker.name}
            onMore={() => router.push({ pathname: '/person/[id]', params: { id: String(maker.id) } })}
          />
          <TitleRow titles={byMaker.titles} theme={theme} seen={seen} />
        </View>
      )}

      <Text style={[styles.credit, { color: theme.textMuted }]}>Details, cast and recommendations from TMDB.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  block: { gap: 10 },
  tagline: { fontSize: font.body, fontStyle: 'italic', lineHeight: 21 },
  // Justified, like a printed programme note.
  overview: { fontSize: font.body, lineHeight: 22, textAlign: 'justify' },
  showMore: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1, marginTop: 4 },
  facts: { fontFamily: fonts.mono, fontSize: font.footnote },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { borderWidth: 1, borderRadius: 16, height: 32, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1.5 },
  seasons: { gap: 12, paddingRight: 16 },
  season: { width: 96 },
  seasonPoster: { width: 96, height: 144, borderRadius: 6 },
  seasonNo: { fontFamily: fonts.display, fontSize: 40 },
  seasonName: { fontSize: font.footnote, fontWeight: '700', marginTop: 6 },
  seasonSub: { fontFamily: fonts.mono, fontSize: font.caption },
  credit: { fontFamily: fonts.mono, fontSize: font.caption, textAlign: 'center' },
});
