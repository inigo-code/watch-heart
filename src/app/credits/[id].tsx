import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tmdbKey } from '@/api';
import { aboutTmdb } from '@/api/tmdb';
import type { Person, TitleAbout } from '@/api/tmdb';
import { SectionLabel } from '@/components/SectionLabel';
import { Face } from '@/components/title/Rows';
import { font, fonts, useTheme } from '@/lib/theme';
import { useSettings } from '@/settings/SettingsProvider';

/** Everyone in a title, and the key crew, each opening their own page. */
export default function CreditsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = tmdbKey(useSettings().settings.tmdbKey);
  const [about, setAbout] = useState<TitleAbout | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!key || !id) return;
    const controller = new AbortController();
    aboutTmdb(key, id, controller.signal)
      .then(setAbout)
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, [key, id]);

  if (!about) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        {failed ? <Text style={[styles.role, { color: theme.textMuted }]}>Couldn’t load the cast. Check your connection.</Text> : <ActivityIndicator color={theme.accent} />}
      </View>
    );
  }

  const sections = [
    { title: `Cast (${about.cast.length})`, data: about.cast },
    { title: `Crew (${about.crew.length})`, data: about.crew },
  ].filter((s) => s.data.length);

  return (
    <SectionList<Person>
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      sections={sections}
      keyExtractor={(p, i) => `${p.id}:${i}`}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={<Text style={[styles.title, { color: theme.text }]}>{about.title.title.toUpperCase()}</Text>}
      renderSectionHeader={({ section }) => <SectionLabel theme={theme} style={styles.section}>{section.title}</SectionLabel>}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/person/[id]', params: { id: String(item.id) } })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Face uri={item.photo} name={item.name} theme={theme} size={48} round />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
            {!!item.role && <Text style={[styles.role, { color: theme.textMuted }]}>{item.role}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34, letterSpacing: 1 },
  section: { marginTop: 18, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: font.body, fontWeight: '700' },
  role: { fontFamily: fonts.mono, fontSize: font.footnote, marginTop: 2 },
});
