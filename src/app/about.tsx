import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandTitle } from '@/components/BrandTitle';
import { Sprockets } from '@/components/Film';
import { Row, Section } from '@/components/SettingsUI';
import { APP_TAGLINE, DATA_SOURCES, DEVELOPER, SUPPORT_EMAIL } from '@/lib/app';
import { font, fonts, useTheme } from '@/lib/theme';

export default function AboutScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '';

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <View style={[styles.card, { backgroundColor: theme.dark ? '#000000' : theme.text }]}>
        <Sprockets color={theme.bg} count={14} hole={6} />
        <View style={styles.cardBody}>
          <BrandTitle theme={{ ...theme, text: theme.dark ? theme.text : theme.bg }} size={44} />
          <Text style={[styles.tagline, { color: theme.accent }]}>{APP_TAGLINE.toUpperCase()}</Text>
          <Text style={[styles.version, { color: theme.textMuted }]}>Version {version}</Text>
        </View>
        <Sprockets color={theme.bg} count={14} hole={6} />
      </View>

      <Section theme={theme} title="Credits" footer={`${DATA_SOURCES.tmdb.notice} ${DATA_SOURCES.tvmaze.notice}`}>
        <Row theme={theme} icon="film-outline" label="Films and series" value="TMDB" onPress={() => Linking.openURL(DATA_SOURCES.tmdb.url)} />
        <Row theme={theme} icon="sparkles-outline" label="Anime" value="AniList" onPress={() => Linking.openURL(DATA_SOURCES.anilist.url)} />
        <Row theme={theme} icon="tv-outline" label="Series (no key)" value="TVmaze" onPress={() => Linking.openURL(DATA_SOURCES.tvmaze.url)} last />
      </Section>

      <Section theme={theme} title="Made by">
        <Row theme={theme} icon="logo-github" label={DEVELOPER.name} value="GitHub" onPress={() => Linking.openURL(DEVELOPER.github)} />
        <Row theme={theme} icon="mail-outline" label="Send feedback" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Watch%20Heart`)} last />
      </Section>

      <Text style={[styles.privacy, { color: theme.textMuted }]}>
        Your diary lives on this phone. If you sign in, it’s also kept in your private account so your devices stay in sync; nobody
        else can read it. Searches go straight to TMDB, AniList or TVmaze.
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
  privacy: { fontFamily: fonts.mono, fontSize: font.footnote, lineHeight: 19, textAlign: 'center', paddingHorizontal: 12 },
});
