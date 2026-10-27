import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Stack, router } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { tmdbKey } from '@/api';
import { resolveShared } from '@/api/links';
import { useToast } from '@/components/Toast';
import { font, fonts, useTheme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';

// Opened when a link or text is shared to the app (see +native-intent.ts): an IMDb, Letterboxd, TMDB,
// AniList, MyAnimeList or TVmaze link opens that title ready to log; anything else becomes a search.
export default function ShareScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { settings } = useSettings();
  const { shareIntent, resetShareIntent } = useShareIntentContext();
  const shared = [shareIntent.text, shareIntent.webUrl].filter(Boolean).join('\n');
  const pageTitle = shareIntent.meta?.title ?? '';
  const handled = useRef('');

  useEffect(() => {
    if (!shared || handled.current === shared) return;
    handled.current = shared;
    const controller = new AbortController();
    const key = tmdbKey(settings.tmdbKey);
    resolveShared(pageTitle && !shared.includes(pageTitle) ? `${pageTitle}\n${shared}` : shared, key, controller.signal).then((r) => {
      if (controller.signal.aborted) return;
      resetShareIntent();
      if ('title' in r) {
        router.replace({ pathname: '/log', params: { title: JSON.stringify(r.title) } });
      } else {
        // Film links (IMDb, TMDB, Letterboxd) open straight away once there's a TMDB key.
        toast(key ? 'Couldn’t match that link exactly, so here’s a search' : 'Add a TMDB key in Settings to open film links straight away');
        router.replace({ pathname: '/search', params: { q: r.query, ...(r.kind ? { kind: r.kind } : {}) } });
      }
    });
    return () => controller.abort();
  }, [shared, pageTitle, settings.tmdbKey, resetShareIntent, toast]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ title: '' }} />
      <MaterialCommunityIcons name="ticket-confirmation-outline" size={56} color={theme.accent} />
      <Text style={[styles.title, { color: theme.text }]}>READING YOUR TICKET</Text>
      <Text style={[styles.body, { color: theme.textMuted }]} numberOfLines={3}>
        {shared || 'Waiting for the shared link…'}
      </Text>
      <ActivityIndicator color={theme.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  title: { fontFamily: fonts.display, fontSize: 32, letterSpacing: 1.5 },
  body: { fontFamily: fonts.mono, fontSize: font.footnote, textAlign: 'center', lineHeight: 19 },
});
