import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Poster } from '@/components/Film';
import { SectionLabel } from '@/components/SectionLabel';
import { warmScores } from '@/lib/titleScores';
import { font, fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';
import { tmdbKey } from '@/api';
import { aboutTmdb } from '@/api/tmdb';
import type { Person } from '@/api/tmdb';
import type { Title } from '@/store/types';

/**
 * Starts loading a title's page (its details, and the backdrop picture) when it's touched, so by the time the
 * tap lifts and the page opens, most of it is already here.
 */
export function warmTitle(t: Title) {
  if (t.source !== 'tmdb' || !t.sourceId) return;
  const key = tmdbKey('');
  if (key) aboutTmdb(key, t.sourceId).catch(() => {});
  // Scores and where to watch too, which the page used to start only once it had opened.
  warmScores({ source: t.source, sourceId: t.sourceId, title: t.title, year: t.year, series: t.kind !== 'movie' });
  const picture = t.backdropUrl ?? t.posterUrl;
  if (picture) Image.prefetch(picture, 'memory-disk').catch(() => {});
}

/**
 * A title's page, for TMDB titles; anything else (TVmaze, AniList, typed in) has no page yet, so it opens
 * the log form as before.
 */
export function openTitle(t: Title) {
  if (t.source === 'tmdb' && t.sourceId) router.push({ pathname: '/title/[id]', params: { id: t.sourceId, t: JSON.stringify(t) } });
  else router.push({ pathname: '/log', params: { title: JSON.stringify(t) } });
}

/** A sideways row of posters, each opening its title's page. `seen` marks the ones in your diary. Titles with no poster are left out. */
export function TitleRow({ titles, theme, seen, width = 104 }: { titles: Title[]; theme: Theme; seen?: (t: Title) => boolean; width?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {titles.filter((t) => t.posterUrl).map((t) => (
        <Pressable
          key={`${t.source}:${t.sourceId}`}
          onPressIn={() => warmTitle(t)}
          onPress={() => openTitle(t)}
          accessibilityRole="button"
          accessibilityLabel={`${t.title}${t.year ? `, ${t.year}` : ''}`}
          style={({ pressed }) => [{ width }, pressed && { opacity: 0.8 }]}
        >
          <View>
            <Poster uri={t.posterUrl} title={t.title} width={width} theme={theme} radius={6} style={seen?.(t) && styles.watched} />
            {seen?.(t) && (
              <View style={[styles.seen, { backgroundColor: theme.accent }]}>
                <Ionicons name="checkmark" size={13} color={theme.accentText} />
              </View>
            )}
          </View>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
            {t.title}
          </Text>
          {!!t.year && <Text style={[styles.sub, { color: theme.textMuted }]}>{t.year}</Text>}
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** A sideways row of people: photo, name, and their role (the character, or the job). */
export function PeopleRow({ people, theme }: { people: Person[]; theme: Theme }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {people.map((p, i) => (
        <Pressable
          key={`${p.id}:${i}`}
          onPress={() => router.push({ pathname: '/person/[id]', params: { id: String(p.id) } })}
          accessibilityRole="button"
          accessibilityLabel={`${p.name}${p.role ? `, ${p.role}` : ''}`}
          style={({ pressed }) => [styles.person, pressed && { opacity: 0.8 }]}
        >
          <Face uri={p.photo} name={p.name} theme={theme} size={88} />
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
            {p.name}
          </Text>
          {!!p.role && (
            <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={2}>
              {p.role}
            </Text>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** A person's photo, or their initials when TMDB has none. */
export function Face({ uri, name, theme, size, round }: { uri: string | null; name: string; theme: Theme; size: number; round?: boolean }) {
  const style = { width: size, height: round ? size : size * 1.25, borderRadius: round ? size / 2 : 8, backgroundColor: theme.elevated };
  if (uri) return <Image source={{ uri }} style={style} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={[style, styles.initials]}>
      <Text style={[styles.initialsText, { color: theme.textMuted, fontSize: size * 0.3 }]}>{initials}</Text>
    </View>
  );
}

/** A section's heading with an optional "see all" link on the right. */
export function RowHead({ title, theme, more, onMore }: { title: string; theme: Theme; more?: string; onMore?: () => void }) {
  return (
    <View style={styles.head}>
      <SectionLabel theme={theme} style={{ flex: 1 }}>
        {title}
      </SectionLabel>
      {onMore && (
        <Pressable onPress={onMore} hitSlop={10} accessibilityRole="button" style={styles.more}>
          <Text style={[styles.moreText, { color: theme.textMuted }]}>{(more ?? 'See all').toUpperCase()}</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingRight: 16 },
  name: { fontSize: font.footnote, fontWeight: '700', marginTop: 6, lineHeight: 17 },
  sub: { fontFamily: fonts.mono, fontSize: font.caption, marginTop: 1 },
  // Seen ones step back, so what you haven't watched stands out.
  watched: { opacity: 0.25 },
  seen: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  person: { width: 88 },
  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontFamily: fonts.display },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  moreText: { fontFamily: fonts.monoBold, fontSize: font.caption, letterSpacing: 1 },
});
