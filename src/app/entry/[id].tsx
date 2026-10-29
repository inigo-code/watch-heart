import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Stars } from '@/components/Film';
import { Hero } from '@/components/Hero';
import { trackable } from '@/api/episodes';
import { DangerButton } from '@/components/DangerButton';
import { AddToList } from '@/components/lists/AddToList';
import { RichText } from '@/components/RichText';
import { SectionLabel } from '@/components/SectionLabel';
import { TitleExtras } from '@/components/TitleExtras';
import { Synopsis, TitleMore, useAbout } from '@/components/title/AboutTitle';
import { Face, openTitle } from '@/components/title/Rows';
import { useToast } from '@/components/Toast';
import { dayParts, friendlyDate } from '@/lib/dates';
import { viewingLine } from '@/lib/viewing';
import { font, fonts, useTheme } from '@/lib/theme';
import { useLists } from '@/lists/ListsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Title } from '@/store/types';

export default function EntryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, getEntry, viewingsOf, deleteEntry, restoreEntry } = useDiary();
  const entry = getEntry(id);
  const [reveal, setReveal] = useState(false);
  const [listing, setListing] = useState(false);
  const { listsWith } = useLists();
  const { about } = useAbout(entry?.source === 'tmdb' ? entry.sourceId : null);

  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (!entry || entry.deletedAt !== null) {
    return (
      <View style={[styles.missing, { backgroundColor: theme.bg }]}>
        <Stack.Screen options={{ headerTransparent: false }} />
        <Text style={[styles.missingText, { color: theme.textMuted }]}>This entry is gone. It may be in Trash.</Text>
      </View>
    );
  }

  const viewings = viewingsOf(entry.source, entry.sourceId);
  const title: Title = {
    kind: entry.kind,
    source: entry.source,
    sourceId: entry.sourceId,
    title: entry.title,
    year: entry.year,
    posterUrl: entry.posterUrl,
    backdropUrl: entry.backdropUrl,
    genres: entry.genres,
    runtime: entry.runtime,
    credit: entry.credit,
  };
  const onLists = listsWith(entry);
  const { day, weekday, month } = dayParts(entry.watchedOn);
  const hideReview = entry.spoilers && !reveal;

  const remove = () => {
    deleteEntry(entry.id);
    toast(`Moved “${entry.title}” to Trash`, { label: 'Undo', onPress: () => restoreEntry(entry.id) });
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          headerTintColor: '#FFFFFF',
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/log', params: { id: entry.id } })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Edit entry"
            >
              <Ionicons name="create-outline" size={24} color="#FFFFFF" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <Hero t={entry} theme={theme} topInset={insets.top} />

        <View style={styles.body}>
          <View style={[styles.ticket, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.stub, { borderRightColor: theme.border }]}>
              <Text style={[styles.stubSmall, { color: theme.textMuted }]}>{weekday.toUpperCase()}</Text>
              <Text style={[styles.stubDay, { color: theme.text }]}>{day}</Text>
              <Text style={[styles.stubSmall, { color: theme.textMuted }]}>{month.toUpperCase()}</Text>
            </View>
            <View style={styles.ticketBody}>
              <Text style={[styles.watched, { color: theme.textMuted }]}>
                {entry.rewatch ? 'REWATCHED' : 'WATCHED'} {entry.undated ? '· DATE UNKNOWN' : friendlyDate(entry.watchedOn).toUpperCase()}
              </Text>
              <View style={styles.line}>
                {entry.rating ? (
                  <Stars rating={entry.rating} size={22} color={theme.star} />
                ) : (
                  <Text style={[styles.unrated, { color: theme.textMuted }]}>No rating</Text>
                )}
                {entry.liked && <Ionicons name="heart" size={22} color={theme.like} accessibilityLabel="Liked" />}
              </View>
              {!!entry.progress && <Text style={[styles.progress, { color: theme.text }]}>{entry.progress}</Text>}
              {!!entry.companions?.length && (
                <View style={styles.with}>
                  <Ionicons name="people" size={15} color={theme.textMuted} />
                  <Text style={[styles.withLabel, { color: theme.textMuted }]}>WITH</Text>
                  {entry.companions.map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => router.navigate({ pathname: '/', params: { q: n } })}
                      accessibilityRole="button"
                      accessibilityLabel={`Everything you watched with ${n}`}
                    >
                      <Text style={[styles.withName, { color: theme.accent }]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>

          {(!!entry.vibes?.length || !!viewingLine(entry) || !!entry.character) && (
            <View style={styles.viewingWrap}>
              {!!entry.vibes?.length && (
                <View style={styles.vibes}>
                  {entry.vibes.map((v) => (
                    <Text key={v} style={[styles.vibe, { color: theme.accentText, backgroundColor: theme.accent }]}>
                      {v.toUpperCase()}
                    </Text>
                  ))}
                </View>
              )}
              {!!viewingLine(entry) && <Text style={[styles.viewingLine, { color: theme.textMuted }]}>{viewingLine(entry)}</Text>}
              {entry.character && (
                <View style={[styles.character, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Face uri={entry.character.photo} name={entry.character.name} theme={theme} size={48} round />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.characterLabel, { color: theme.accent }]}>FAVOURITE CHARACTER</Text>
                    <Text style={[styles.characterName, { color: theme.text }]}>{entry.character.name}</Text>
                    {!!entry.character.actor && <Text style={[styles.characterActor, { color: theme.textMuted }]}>{entry.character.actor}</Text>}
                  </View>
                </View>
              )}
            </View>
          )}

          <TitleExtras source={entry.source} sourceId={entry.sourceId} imdbId={entry.imdbId} theme={theme} />

          {!!entry.review && (
            <View style={styles.reviewWrap}>
              <SectionLabel theme={theme}>REVIEW</SectionLabel>
              {hideReview ? (
                <Pressable
                  onPress={() => setReveal(true)}
                  style={[styles.spoiler, { backgroundColor: theme.card, borderColor: theme.border }]}
                  accessibilityRole="button"
                >
                  <Ionicons name="eye-off-outline" size={18} color={theme.textMuted} />
                  <Text style={[styles.spoilerText, { color: theme.textMuted }]}>Contains spoilers. Tap to read.</Text>
                </Pressable>
              ) : (
                <RichText text={entry.review} theme={theme} style={{ ...styles.review, color: theme.text }} />
              )}
            </View>
          )}

          {entry.tags.length > 0 && (
            <View style={styles.tags}>
              {entry.tags.map((t) => (
                <Text key={t} style={[styles.tag, { color: theme.text, borderColor: theme.border }]}>
                  #{t}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Action
              theme={theme}
              icon="sparkles-outline"
              label="STORY CARD"
              onPress={() => router.push({ pathname: '/card/[id]', params: { id: entry.id } })}
              primary
            />
            <Action theme={theme} icon="repeat" label="LOG AGAIN" onPress={() => router.push({ pathname: '/log', params: { again: entry.id } })} />
            <Action theme={theme} icon="albums-outline" label={onLists.length ? `LISTS (${onLists.length})` : 'ADD TO LIST'} onPress={() => setListing(true)} />
            {trackable(entry) && (
              <Action
                theme={theme}
                icon="list-outline"
                label="EPISODES"
                onPress={() =>
                  router.push({
                    pathname: '/track',
                    params: {
                      title: JSON.stringify({
                        kind: entry.kind,
                        source: entry.source,
                        sourceId: entry.sourceId,
                        title: entry.title,
                        year: entry.year,
                        posterUrl: entry.posterUrl,
                        backdropUrl: entry.backdropUrl,
                        genres: entry.genres,
                        runtime: entry.runtime,
                        credit: entry.credit,
                      }),
                    },
                  })
                }
              />
            )}
          </View>

          {viewings.length > 1 && (
            <View style={styles.viewings}>
              <SectionLabel theme={theme}>YOUR VIEWINGS ({viewings.length})</SectionLabel>
              {viewings.map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => v.id !== entry.id && router.push({ pathname: '/entry/[id]', params: { id: v.id } })}
                  style={[styles.viewing, { borderBottomColor: theme.border }]}
                >
                  <Text style={[styles.viewingDate, { color: v.id === entry.id ? theme.accent : theme.text }]}>{friendlyDate(v.watchedOn)}</Text>
                  <Stars rating={v.rating} size={13} color={theme.star} />
                  {v.liked && <Ionicons name="heart" size={13} color={theme.like} />}
                </Pressable>
              ))}
            </View>
          )}

          {about && (
            <>
              <Synopsis
                about={about}
                overview=""
                theme={theme}
                label={entry.kind === 'movie' ? 'About the film' : entry.kind === 'tv' ? 'About the series' : 'About the anime'}
                onMore={() => openTitle(title)}
              />
              <TitleMore id={entry.sourceId} t={title} about={about} theme={theme} />
            </>
          )}

          <DangerButton theme={theme} label="Move to trash" onPress={remove} />
        </View>
      </ScrollView>
      <AddToList item={listing ? entry : null} theme={theme} onClose={() => setListing(false)} />
    </View>
  );
}

function Action({
  theme,
  icon,
  label,
  onPress,
  primary,
}: {
  theme: ReturnType<typeof useTheme>;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const fg = primary ? theme.accentText : theme.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        primary ? { backgroundColor: theme.accent } : { borderColor: theme.border, borderWidth: 1 },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={icon} size={17} color={fg} />
      <Text style={[styles.actionText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  viewingWrap: { gap: 10 },
  vibes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  vibe: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  viewingLine: { fontFamily: fonts.mono, fontSize: font.footnote },
  character: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 10 },
  characterLabel: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 1.5 },
  characterName: { fontSize: font.body, fontWeight: '700' },
  characterActor: { fontFamily: fonts.mono, fontSize: font.caption },
  with: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  withLabel: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1.5 },
  withName: { fontSize: font.body, fontWeight: '700', textDecorationLine: 'underline' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  missingText: { fontFamily: fonts.mono, fontSize: font.body, textAlign: 'center' },
  body: { padding: 16, gap: 20 },
  ticket: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  stub: { width: 76, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRightWidth: 1.5, borderStyle: 'dashed' },
  stubSmall: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1 },
  stubDay: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, includeFontPadding: false },
  ticketBody: { flex: 1, padding: 14, gap: 8, justifyContent: 'center' },
  watched: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unrated: { fontFamily: fonts.mono, fontSize: font.body },
  progress: { fontFamily: fonts.mono, fontSize: font.footnote },
  reviewWrap: { gap: 8 },
  review: { fontSize: font.headline, lineHeight: 26 },
  spoiler: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 16 },
  spoilerText: { fontFamily: fonts.mono, fontSize: font.body },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { fontFamily: fonts.mono, fontSize: font.footnote, borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23 },
  actionText: { fontFamily: fonts.monoBold, fontSize: font.footnote, letterSpacing: 1 },
  viewings: { gap: 4 },
  viewing: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  viewingDate: { fontFamily: fonts.mono, fontSize: font.body, flex: 1 },
});
