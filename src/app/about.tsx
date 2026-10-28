import * as Linking from 'expo-linking';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandTitle } from '@/components/BrandTitle';
import { Sprockets } from '@/components/Film';
import { Row, Section } from '@/components/SettingsUI';
import { UpdateCard, describeRunning } from '@/components/UpdateRow';
import { ANILIST_ALLOWED, APP_TAGLINE, DATA_SOURCES, DEVELOPER, SUPPORT_EMAIL } from '@/lib/app';
import { font, fonts, useTheme } from '@/lib/theme';

export default function AboutScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <View style={[styles.card, { backgroundColor: theme.dark ? '#000000' : theme.text }]}>
        <Sprockets color={theme.bg} count={14} hole={6} />
        <View style={styles.cardBody}>
          <BrandTitle theme={{ ...theme, text: theme.dark ? theme.text : theme.bg }} size={44} />
          <Text style={[styles.tagline, { color: theme.accent }]}>{APP_TAGLINE.toUpperCase()}</Text>
          <Text style={[styles.version, { color: theme.textMuted }]}>Version {describeRunning()}</Text>
        </View>
        <Sprockets color={theme.bg} count={14} hole={6} />
      </View>

      <UpdateCard theme={theme} />

      <Section theme={theme} title="Credits">
        <Row theme={theme} icon="film-outline" label="Films, series and anime" value="TMDB" onPress={() => Linking.openURL(DATA_SOURCES.tmdb.url)} />
        {ANILIST_ALLOWED && (
          <Row theme={theme} icon="sparkles-outline" label="Anime (without a TMDB key)" value="AniList" onPress={() => Linking.openURL(DATA_SOURCES.anilist.url)} />
        )}
        <Row theme={theme} icon="tv-outline" label="Series (without a TMDB key)" value="TVmaze" onPress={() => Linking.openURL(DATA_SOURCES.tvmaze.url)} last />
      </Section>

      {/* TMDB's required credit: its logo and notice, smaller and quieter than Watch Heart's own name. */}
      <Pressable onPress={() => Linking.openURL(DATA_SOURCES.tmdb.url)} accessibilityRole="link" accessibilityLabel="TMDB, The Movie Database" style={styles.tmdb}>
        <Image source={require('../../assets/tmdb-logo.png')} style={styles.tmdbLogo} resizeMode="contain" accessibilityIgnoresInvertColors />
        <Text style={[styles.tmdbNotice, { color: theme.textMuted }]}>{DATA_SOURCES.tmdb.notice}</Text>
        <Text style={[styles.tmdbNotice, { color: theme.textMuted }]}>{DATA_SOURCES.tvmaze.notice}</Text>
      </Pressable>

      <Section theme={theme} title="Made by">
        <Row theme={theme} icon="logo-github" label={DEVELOPER.name} value="GitHub" onPress={() => Linking.openURL(DEVELOPER.github)} />
        <Row theme={theme} icon="mail-outline" label="Send feedback" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Watch%20Heart`)} last />
      </Section>

      <Text style={[styles.privacy, { color: theme.textMuted }]}>
        Your diary lives on this phone. If you sign in, it’s also kept in your private account so your devices stay in sync; nobody
        else can read it. Searches go straight to TMDB or TVmaze.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24 },
  card: { borderRadius: 6, paddingVertical: 8, gap: 12 },
  cardBody: { alignItems: 'center', gap: 6, paddingVertical: 14 },
  tagline: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1.5 },
  version: { fontFamily: fonts.mono, fontSize: font.caption },
  tmdb: { gap: 6, paddingHorizontal: 4, marginTop: -8 },
  // Smaller than Watch Heart's own title, as TMDB's terms ask.
  tmdbLogo: { width: 78, height: 10, opacity: 0.85 },
  tmdbNotice: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17 },
  privacy: { fontFamily: fonts.mono, fontSize: font.footnote, lineHeight: 19, textAlign: 'center', paddingHorizontal: 12 },
});
