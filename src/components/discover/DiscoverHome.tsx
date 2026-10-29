import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BROWSE_GENRES, regionProviders } from '@/api/tmdb';
import type { BrowseQuery, Provider } from '@/api/tmdb';
import { SectionLabel } from '@/components/SectionLabel';
import { COUNTRIES, DECADES, LANGUAGES, SHELVES, countryName, flag, seasonalShelf } from '@/lib/discover';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

const providerCache = new Map<string, Provider[]>();

export const browse = (q: BrowseQuery, name: string, filters?: boolean) =>
  router.push({ pathname: '/browse', params: { q: JSON.stringify(q), name, ...(filters ? { filters: '1' } : {}) } });

/**
 * Ways into the catalogue: streaming services, ready-made shelves, and genre, decade, language and country.
 * One page for films, series and anime alike; what's shown starts with films, and switches on the results.
 */
export function DiscoverHome({ theme, tmdb, region }: { theme: Theme; tmdb: string; region: string }) {
  const [providers, setProviders] = useState<Provider[]>(() => providerCache.get(region) ?? []);

  useEffect(() => {
    if (providerCache.has(region)) return;
    const controller = new AbortController();
    regionProviders(tmdb, region, controller.signal)
      .then((list) => {
        const top = list.filter((p) => p.logo).slice(0, 12);
        providerCache.set(region, top);
        setProviders(top);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [tmdb, region]);

  const seasonal = seasonalShelf();
  const kind = 'movie';

  return (
    <View style={styles.wrap}>
      {providers.length > 0 && (
        <View style={styles.section}>
          <SectionLabel theme={theme}>On your services · {region}</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providers}>
            {providers.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => browse({ kind, provider: p.id, region }, p.name)}
                accessibilityRole="button"
                accessibilityLabel={`What's on ${p.name}`}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              >
                <Image source={{ uri: p.logo }} style={[styles.logo, { backgroundColor: theme.elevated }]} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.section}>
        <SectionLabel theme={theme}>Collections</SectionLabel>
        {seasonal && (
          <Pressable
            onPress={() => browse(seasonal.q, seasonal.name)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.feature, { backgroundColor: theme.card, borderColor: theme.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name={seasonal.id === 'halloween' ? 'moon' : seasonal.id === 'valentine' ? 'heart' : 'snow'} size={26} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.featureName, { color: theme.text }]}>{seasonal.name.toUpperCase()}</Text>
              <Text style={[styles.note, { color: theme.textMuted }]}>{seasonal.note}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </Pressable>
        )}
        <View style={[styles.shelves, { borderColor: theme.border, backgroundColor: theme.card }]}>
          {SHELVES.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => browse(s.q, s.name)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.shelf, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { backgroundColor: theme.chip }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.shelfName, { color: theme.text }]}>{s.name}</Text>
                <Text style={[styles.note, { color: theme.textMuted }]}>{s.note}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>

      <Chips theme={theme} title="By genre" items={BROWSE_GENRES.map((g) => ({ key: g.name, label: g.name, onPress: () => browse({ kind: g.movie ? kind : 'tv', genres: [g.name] }, g.name) }))} />
      <Chips
        theme={theme}
        title="By decade"
        items={DECADES.map((d) => ({ key: String(d), label: `${d}s`, onPress: () => browse({ kind, from: d, to: d + 9 }, `The ${d}s`) }))}
      />
      <Chips
        theme={theme}
        title="By original language"
        items={LANGUAGES.map((l) => ({ key: l.code, label: l.name, onPress: () => browse({ kind, lang: l.code }, `In ${l.name}`) }))}
      />
      <Chips
        theme={theme}
        title="By country"
        items={COUNTRIES.map((c) => ({ key: c, label: `${flag(c)} ${c}`, a11y: countryName(c), onPress: () => browse({ kind, country: c }, `From ${countryName(c)}`) }))}
      />

      <Pressable
        onPress={() => browse({ kind }, 'Your filters', true)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.build, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name="options-outline" size={20} color={theme.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.shelfName, { color: theme.text }]}>Build your own</Text>
          <Text style={[styles.note, { color: theme.textMuted }]}>Mix genre, decade, language, score, length and service</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </Pressable>
      <Text style={[styles.credit, { color: theme.textMuted }]}>Discover by TMDB · streaming data by JustWatch</Text>
    </View>
  );
}

function Chips({ theme, title, items }: { theme: Theme; title: string; items: { key: string; label: string; a11y?: string; onPress: () => void }[] }) {
  return (
    <View style={styles.section}>
      <SectionLabel theme={theme}>{title}</SectionLabel>
      <View style={styles.chips}>
        {items.map((it) => (
          <Pressable
            key={it.key}
            onPress={it.onPress}
            accessibilityRole="button"
            accessibilityLabel={it.a11y}
            style={({ pressed }) => [styles.chip, { backgroundColor: pressed ? theme.chipActive : theme.chip }]}
          >
            <Text style={[styles.chipText, { color: theme.text }]}>{it.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24, paddingTop: 8 },
  section: { gap: 10 },
  providers: { gap: 10, paddingRight: 16 },
  logo: { width: 56, height: 56, borderRadius: 12 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderRadius: 14, padding: 14 },
  featureName: { fontFamily: fonts.display, fontSize: 24, letterSpacing: 1 },
  shelves: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  shelf: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  shelfName: { fontSize: font.body, fontWeight: '700' },
  note: { fontFamily: fonts.mono, fontSize: font.caption, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: font.footnote, fontWeight: '600' },
  build: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 14 },
  credit: { fontFamily: fonts.mono, fontSize: font.caption, textAlign: 'center' },
});
