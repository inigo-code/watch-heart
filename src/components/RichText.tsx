import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';

import { parseRich } from '@/lib/richText';
import type { Theme } from '@/lib/theme';

/** A review with its paragraphs, quotes, bold and italics. */
export function RichText({ text, theme, style }: { text: string; theme: Theme; style?: TextStyle }) {
  const blocks = parseRich(text);
  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => (
        <View key={i} style={b.quote ? [styles.quote, { borderLeftColor: theme.accent }] : undefined}>
          <Text style={[style, b.quote && { color: theme.textMuted, fontStyle: 'italic' }]}>
            {b.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && '\n'}
                {line.map((s, k) => (
                  <Text key={k} style={[s.bold && styles.bold, s.italic && styles.italic]}>
                    {s.text}
                  </Text>
                ))}
              </Fragment>
            ))}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  quote: { borderLeftWidth: 3, paddingLeft: 12 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
});
