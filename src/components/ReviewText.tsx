import { StyleSheet, View } from 'react-native';
import type { TextStyle } from 'react-native';

import { Text } from '@/components/AppText';
import { RichText } from '@/components/RichText';
import { headingOf } from '@/lib/review';
import { fonts } from '@/lib/theme';
import type { Theme } from '@/lib/theme';

/** A review as it's read: its heading in bold, if it has one, then the words. `style` is the review's own text style. */
export function ReviewText({ entry, theme, style }: { entry: { review: string; heading?: string | null }; theme: Theme; style: TextStyle }) {
  const heading = headingOf(entry);
  if (!heading) return <RichText text={entry.review} theme={theme} style={style} />;
  const size = (style.fontSize ?? 16) + 1;
  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { fontSize: size, lineHeight: Math.round(size * 1.3), color: style.color ?? theme.text }]} accessibilityRole="header">
        {heading}
      </Text>
      {!!entry.review.trim() && <RichText text={entry.review} theme={theme} style={style} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  heading: { fontFamily: fonts.uiBold },
});
