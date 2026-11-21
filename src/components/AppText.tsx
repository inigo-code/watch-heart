import { createContext, useContext } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { fonts } from '@/lib/theme';

// Text follows the phone's font size, up to this much. Past it, cards and rows built for normal text start
// to overlap and clip, which is what people with a large or larger system font were seeing (Android 14
// scales up to 2x). Big headings cap at the same 1.15 or lower.
const MOST = 1.15;

/** The app's own text size (Settings → Look → Text size), on top of the phone's. 1 = as designed. */
const TextSize = createContext(1);

/** True inside another Text, whose face a nested run inherits unless it asks for a weight of its own. */
const Nested = createContext(false);

export function TextSizeProvider({ size, children }: { size: number; children: ReactNode }) {
  return <TextSize.Provider value={size}>{children}</TextSize.Provider>;
}

// Read when text is drawn, not at load: theme.ts and this file can load in either order.
const isUiFace = (family: string) => family === fonts.ui || family === fonts.uiMedium || family === fonts.uiSemibold || family === fonts.uiBold;

/** Instrument Sans at a weight: Android can't make a custom face bolder, so each weight is its own file. */
function uiFace(weight: TextStyle['fontWeight']) {
  switch (String(weight ?? '400')) {
    case '500':
      return fonts.uiMedium;
    case '600':
      return fonts.uiSemibold;
    case '700':
    case '800':
    case '900':
    case 'bold':
      return fonts.uiBold;
    default:
      return fonts.ui;
  }
}

/**
 * The style as drawn: Instrument Sans at its weight unless it names another face (the marquee, a ticket's
 * typewriter), and its font size and line height grown by the app's text size. Text without a size of its
 * own inherits its parent's (already grown), and text that opts out of scaling (stories, tab labels)
 * stays as drawn, so a story looks the same whatever the setting.
 */
function styled(style: StyleProp<TextStyle>, size: number, scales: boolean | undefined, nested: boolean) {
  const flat = StyleSheet.flatten(style) ?? {};
  const extra: { -readonly [K in keyof TextStyle]: TextStyle[K] } = {};
  const family = flat.fontFamily;
  // A run inside other text with no face or weight of its own keeps its parent's face.
  if (!family ? !nested || flat.fontWeight !== undefined : isUiFace(family)) {
    extra.fontFamily = family && flat.fontWeight === undefined ? family : uiFace(flat.fontWeight);
    // The weight is in the file; asking Android for bold on top would smear it.
    extra.fontWeight = 'normal';
  }
  if (size !== 1 && scales !== false && typeof flat.fontSize === 'number') {
    extra.fontSize = flat.fontSize * size;
    if (typeof flat.lineHeight === 'number') extra.lineHeight = flat.lineHeight * size;
  }
  return Object.keys(extra).length ? [style, extra] : style;
}

/** The app's text: React Native's, in the app's faces, with the font-size cap and the app's text size. */
export function Text({ children, ...props }: ComponentProps<typeof RNText>) {
  const size = useContext(TextSize);
  const nested = useContext(Nested);
  return (
    <RNText maxFontSizeMultiplier={MOST} {...props} style={styled(props.style, size, props.allowFontScaling, nested)}>
      {nested ? children : <Nested.Provider value>{children}</Nested.Provider>}
    </RNText>
  );
}

/** The app's text box: React Native's, in the app's face, with the font-size cap and the app's text size. */
export function TextInput(props: ComponentProps<typeof RNTextInput>) {
  const size = useContext(TextSize);
  return <RNTextInput maxFontSizeMultiplier={MOST} {...props} style={styled(props.style, size, props.allowFontScaling, false)} />;
}
