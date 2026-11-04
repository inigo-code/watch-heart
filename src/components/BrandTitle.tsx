import { Image } from 'expo-image';
import { Image as PlainImage, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

const ICON = require('../../assets/icon.png');

/** The app's logo: the same picture as the icon on the phone. This is the only mark the app uses. */
export function HeartMark({ size = 34 }: { size?: number }) {
  return <Image source={ICON} style={{ width: size, height: size, borderRadius: size * 0.22 }} accessible={false} />;
}

/** The logo for story cards: drawn at once, so a card captured straight away still has it. */
export function CardMark({ size = 14 }: { size?: number }) {
  return <PlainImage source={ICON} style={{ width: size, height: size, borderRadius: size * 0.22 }} fadeDuration={0} />;
}

/** The logo, then WATCH HEART in the marquee face, on one line. */
export function BrandTitle({ theme, size = 29 }: { theme: Theme; size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Watch Heart">
      <HeartMark size={size * 1.03} />
      <Text maxFontSizeMultiplier={1.15} style={[styles.word, { color: theme.text, fontSize: size, lineHeight: size * 1.1 }]}>
        WATCH <Text style={{ color: theme.accent }}>HEART</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  word: { fontFamily: fonts.display, letterSpacing: 1.2, includeFontPadding: false },
});
