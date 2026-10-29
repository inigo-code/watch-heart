import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import type { Theme } from '@/lib/theme';
import type { ListItem } from '@/lists/ListsProvider';

/** A list's cover: its first four posters fanned like a hand of tickets, or an empty slate. */
export function ListCover({ items, theme, width = 132 }: { items: ListItem[]; theme: Theme; width?: number }) {
  const posters = items.filter((i) => i.posterUrl).slice(0, 4);
  const w = width * 0.46;
  const h = w * 1.5;
  if (!posters.length) {
    return (
      <View style={[styles.empty, { width, height: h, backgroundColor: theme.elevated, borderColor: theme.border }]}>
        <Ionicons name="albums-outline" size={26} color={theme.textMuted} />
      </View>
    );
  }
  const step = posters.length > 1 ? (width - w) / (posters.length - 1) : 0;
  return (
    <View style={{ width, height: h }}>
      {posters.map((p, i) => (
        <Image
          key={`${p.source}:${p.sourceId}:${i}`}
          source={p.posterUrl}
          style={[styles.poster, { width: w, height: h, left: i * step, zIndex: 10 - i, borderColor: theme.bg }]}
          contentFit="cover"
          cachePolicy="disk"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  poster: { position: 'absolute', top: 0, borderRadius: 6, borderWidth: 2 },
});
