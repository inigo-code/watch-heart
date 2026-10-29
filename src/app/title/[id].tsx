import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { trackable } from '@/api/episodes';
import { browseGenre } from '@/api/tmdb';
import { Stars } from '@/components/Film';
import { Hero } from '@/components/Hero';
import { AddToList } from '@/components/lists/AddToList';
import { SectionLabel } from '@/components/SectionLabel';
import { TitleExtras } from '@/components/TitleExtras';
import { Synopsis, TitleMore, useAbout } from '@/components/title/AboutTitle';
import { FriendsOnTitle } from '@/components/title/FriendsOnTitle';
import { useToast } from '@/components/Toast';
import { friendlyDate } from '@/lib/dates';
import { font, fonts, useTheme } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { useLists } from '@/lists/ListsProvider';
import { useDiary } from '@/store/DiaryStore';
import type { Title } from '@/store/types';

/**
 * A film or series before (or after) you log it: what it is, who made it, where to watch it, and what
 * to watch next. Opened from search, Discover, recommendations and people's pages.
 */
export default function TitleScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const params = useLocalSearchParams<{ id: string; t?: string }>();
  const id = params.id;
  const { viewingsOf, onWatchlist, addToWatchlist, removeFromWatchlist } = useDiary();
  const { listsWith } = useLists();
  const seed = useMemo(() => (params.t ? (JSON.parse(params.t) as Title) : null), [params.t]);
  const { about: a, error } = useAbout(id);
  const [listing, setListing] = useState(false);

  // Search in the Anime tab knows it's anime; TMDB's own details can't always tell (an anime film, say).
  const t: Title | null = a ? { ...a.title, kind: seed?.kind === 'anime' ? 'anime' : a.title.kind, overview: a.overview } : seed;

  if (!t) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Stack.Screen options={{ headerTransparent: false }} />
        {error ? <Text style={[styles.muted, { color: theme.textMuted }]}>{error}</Text> : <ActivityIndicator color={theme.accent} />}
      </View>
    );
  }

  const viewings = viewingsOf(t.source, t.sourceId);
  const saved = onWatchlist(t);
  const onLists = listsWith(t);

  const log = () => router.push({ pathname: '/log', params: { title: JSON.stringify(t) } });
  const toggleWatchlist = () => {
    if (saved) {
      removeFromWatchlist(saved.id);
      toast('Taken off your watchlist');
    } else {
      addToWatchlist(t);
      toast('Added to your watchlist');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ headerTintColor: '#FFFFFF' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <Hero t={{ ...t, genres: [] }} theme={theme} topInset={insets.top} />

        <View style={styles.body}>
          {t.genres.length > 0 && (
            <View style={styles.genres}>
              {t.genres.map((g) => {
                const genre = browseGenre(g);
                return (
                  <Pressable
                    key={g}
                    disabled={!genre}
                    onPress={() =>
                      genre && router.push({ pathname: '/browse', params: { q: JSON.stringify({ kind: t.kind, genres: [genre.name] }), name: genre.name } })
                    }
                    accessibilityRole={genre ? 'button' : undefined}
                    accessibilityLabel={genre ? `Browse ${g}` : g}
                    style={[styles.genre, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.genreText, { color: theme.text }]}>{g}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={styles.mainActions}>
            <Pressable
              onPress={log}
              accessibilityRole="button"
              style={({ pressed }) => [styles.logBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
            >
              <Ionicons name="add" size={20} color={theme.accentText} />
              <Text style={[styles.logText, { color: theme.accentText }]}>{viewings.length ? 'LOG AGAIN' : 'LOG IT'}</Text>
            </Pressable>
            <Pressable
              onPress={toggleWatchlist}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Take off your watchlist' : 'Add to your watchlist'}
              accessibilityState={{ selected: !!saved }}
              style={({ pressed }) => [
                styles.square,
                { borderColor: saved ? theme.accent : theme.border, backgroundColor: saved ? theme.accent : 'transparent', opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? theme.accentText : theme.text} />
            </Pressable>
          </View>

          <View style={styles.tools}>
            {a?.trailer && <Tool theme={theme} icon="play-circle-outline" label="Trailer" onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${a.trailer}`)} />}
            <Tool theme={theme} icon="albums-outline" label={onLists.length ? `Lists (${onLists.length})` : 'Add to list'} onPress={() => setListing(true)} />
            {trackable(t) && (
              <Tool
                theme={theme}
                icon="list-outline"
                label="Episodes"
                onPress={() => router.push({ pathname: '/track', params: { title: JSON.stringify(t) } })}
              />
            )}
          </View>

          {viewings.length > 0 && (
            <View style={styles.block}>
              <SectionLabel theme={theme}>IN YOUR DIARY · {viewings.length === 1 ? 'SEEN ONCE' : `SEEN ${viewings.length}×`}</SectionLabel>
              {viewings.slice(0, 5).map((v) => (
                <Pressable
                  key={v.id}
                  onPress={() => router.push({ pathname: '/entry/[id]', params: { id: v.id } })}
                  accessibilityRole="button"
                  style={[styles.viewing, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                  <Ionicons name="ticket-outline" size={16} color={theme.accent} />
                  <Text style={[styles.viewingDate, { color: theme.text }]}>{v.undated ? 'Date unknown' : friendlyDate(v.watchedOn)}</Text>
                  {v.rating ? <Stars rating={v.rating} size={13} color={theme.star} /> : null}
                  {v.liked && <Ionicons name="heart" size={14} color={theme.like} />}
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </Pressable>
              ))}
            </View>
          )}

          <Synopsis about={a} overview={t.overview ?? ''} theme={theme} />

          <TitleExtras source={t.source} sourceId={t.sourceId} theme={theme} />

          <FriendsOnTitle source={t.source} sourceId={t.sourceId} theme={theme} />

          {a && <TitleMore id={id} t={t} about={a} theme={theme} />}
        </View>
      </ScrollView>
      <AddToList item={listing ? t : null} theme={theme} onClose={() => setListing(false)} />
    </View>
  );
}

function Tool({ theme, icon, label, onPress }: { theme: Theme; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tool, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={17} color={theme.text} />
      <Text style={[styles.toolText, { color: theme.text }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontFamily: fonts.mono, fontSize: font.body, textAlign: 'center' },
  body: { padding: 16, gap: 22 },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6 },
  genre: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  genreText: { fontSize: font.footnote, fontWeight: '600' },
  mainActions: { flexDirection: 'row', gap: 10 },
  logBtn: { flex: 1, height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logText: { fontFamily: fonts.monoBold, fontSize: font.body, letterSpacing: 1.5 },
  square: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -10 },
  tool: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12 },
  toolText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
  block: { gap: 10 },
  viewing: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 46 },
  viewingDate: { flex: 1, fontFamily: fonts.mono, fontSize: font.body },
});
