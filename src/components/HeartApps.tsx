import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { HEART_APPS } from '@/lib/app';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

const LOGO = require('../../assets/heart-apps.png');
const ICONS: Record<string, number> = { 'Prompt Heart': require('../../assets/prompt-heart.png') };

/** The Heart Apps logo as a small rounded tile (for rows and headings). */
export function HeartAppsMark({ size = 30 }: { size?: number }) {
  return <Image source={LOGO} style={{ width: size, height: size, borderRadius: size * 0.24 }} accessibilityIgnoresInvertColors />;
}

/**
 * Watch Heart's family: the Heart Apps mark and a line about it, Inigo's other apps with their icons, and
 * the way home. Same names and lines as the Heart Apps website.
 */
export function HeartAppsCard({ theme }: { theme: Theme }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.head}>
        <HeartAppsMark size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.name, { color: theme.text }]}>HEART APPS</Text>
          <Text style={[styles.line, { color: theme.textMuted }]}>{HEART_APPS.line}</Text>
        </View>
      </View>
      {HEART_APPS.apps.map((app) => (
        <Pressable
          key={app.name}
          onPress={() => Linking.openURL(app.url)}
          accessibilityRole="link"
          accessibilityLabel={`${app.name}: ${app.tagline}`}
          style={({ pressed }) => [styles.app, { backgroundColor: pressed ? theme.chip : theme.bg, borderColor: theme.border }]}
        >
          <Image source={ICONS[app.name]} style={styles.icon} accessibilityIgnoresInvertColors />
          <View style={{ flex: 1 }}>
            <Text style={[styles.appName, { color: theme.text }]}>{app.name}</Text>
            <Text style={[styles.line, { color: theme.textMuted }]}>{app.tagline}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={theme.textMuted} />
        </Pressable>
      ))}
      <Pressable
        onPress={() => Linking.openURL(HEART_APPS.url)}
        accessibilityRole="link"
        style={({ pressed }) => [styles.home, { backgroundColor: pressed ? theme.border : theme.chip }]}
      >
        <HeartAppsMark size={22} />
        <Text style={[styles.homeText, { color: theme.text }]}>All Heart Apps</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 1, lineHeight: 28 },
  line: { fontFamily: fonts.mono, fontSize: font.caption, lineHeight: 17 },
  app: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 10 },
  icon: { width: 40, height: 40, borderRadius: 10 },
  appName: { fontSize: font.body, fontWeight: '700' },
  home: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, borderRadius: 999, paddingVertical: 7, paddingLeft: 8, paddingRight: 16 },
  homeText: { fontSize: font.footnote, fontWeight: '600' },
});
