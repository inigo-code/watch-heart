import { createContext, useContext } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

// Text follows the phone's font size, up to this much. Past it, cards and rows built for normal text start
// to overlap and clip, which is what people with a large or larger system font were seeing (Android 14
// scales up to 2x). Big headings cap at the same 1.15 or lower.
const MOST = 1.15;

/** The app's own text size (Settings → Look → Text size), on top of the phone's. 1 = as designed. */
const TextSize = createContext(1);

export function TextSizeProvider({ size, children }: { size: number; children: ReactNode }) {
  return <TextSize.Provider value={size}>{children}</TextSize.Provider>;
}

/**
 * The style with its font size and line height grown by the app's text size. Text without a size of its
 * own inherits its parent's (already grown), and text that opts out of scaling (stories, tab labels)
 * stays as drawn, so a story looks the same whatever the setting.
 */
function sized(style: StyleProp<TextStyle>, size: number, scales: boolean | undefined) {
  if (size === 1 || scales === false) return style;
  const flat = StyleSheet.flatten(style);
  if (!flat || typeof flat.fontSize !== 'number') return style;
  const grown: TextStyle = { fontSize: flat.fontSize * size, ...(typeof flat.lineHeight === 'number' ? { lineHeight: flat.lineHeight * size } : null) };
  return [style, grown];
}

/** The app's text: React Native's, with the font-size cap and the app's text size. */
export function Text(props: ComponentProps<typeof RNText>) {
  const size = useContext(TextSize);
  return <RNText maxFontSizeMultiplier={MOST} {...props} style={sized(props.style, size, props.allowFontScaling)} />;
}

/** The app's text box: React Native's, with the font-size cap and the app's text size. */
export function TextInput(props: ComponentProps<typeof RNTextInput>) {
  const size = useContext(TextSize);
  return <RNTextInput maxFontSizeMultiplier={MOST} {...props} style={sized(props.style, size, props.allowFontScaling)} />;
}
