import { Image } from 'expo-image';
import { View } from 'react-native';

// Logo tiles for the apps Watch Heart imports from (Simple Icons, CC0; lettermarks where there is none).
// They're 120 px images, so they stay sharp up to 40 points.

const LOGOS = {
  letterboxd: require('../../assets/logos/letterboxd.png'),
  imdb: require('../../assets/logos/imdb.png'),
  trakt: require('../../assets/logos/trakt.png'),
  moviebase: require('../../assets/logos/moviebase.png'),
  myanimelist: require('../../assets/logos/myanimelist.png'),
  anilist: require('../../assets/logos/anilist.png'),
  netflix: require('../../assets/logos/netflix.png'),
  refract: require('../../assets/logos/refract.png'),
  serializd: require('../../assets/logos/serializd.png'),
  tvtime: require('../../assets/logos/tvtime.png'),
  simkl: require('../../assets/logos/simkl.png'),
  justwatch: require('../../assets/logos/justwatch.png'),
  file: require('../../assets/logos/file.png'),
};

export type LogoKey = keyof typeof LOGOS;

/** The logo for an import source as the importer names it ("Letterboxd", "TV Time", "Other app"). */
export function logoFor(source: string): LogoKey | null {
  const key = source.toLowerCase().replace(/[^a-z]/g, '');
  if (key === 'otherapp') return 'file';
  return key in LOGOS ? (key as LogoKey) : null;
}

/**
 * One tile, or two side by side when a row covers two apps. The slot is always 4/3 of `size` wide,
 * so a list of rows keeps its text in line; `ring` (the card's colour) separates a pair.
 */
export function ImportLogo({ logos, size = 36, ring }: { logos: LogoKey[]; size?: number; ring?: string }) {
  const [first, second] = logos;
  const slot = Math.round((size * 4) / 3);
  const tile = (s: number) => ({ width: s, height: s, borderRadius: s * 0.24 });
  if (!second) {
    return (
      <View style={{ width: slot, alignItems: 'center' }}>
        <Image source={LOGOS[first]} style={tile(size)} accessibilityIgnoresInvertColors />
      </View>
    );
  }
  const small = Math.round(size * 0.72);
  return (
    <View style={{ width: slot, height: size, justifyContent: 'center' }}>
      <Image source={LOGOS[first]} style={[tile(small), { position: 'absolute', left: 0 }]} />
      <Image
        source={LOGOS[second]}
        style={[tile(small + 4), { position: 'absolute', right: -2, borderWidth: 2, borderColor: ring ?? 'transparent' }]}
      />
    </View>
  );
}
