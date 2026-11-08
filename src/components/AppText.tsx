import type { ComponentProps } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';

// Text follows the phone's font size, up to this much. Past it, cards and rows built for normal text start
// to overlap and clip, which is what people with a large or larger system font were seeing (Android 14
// scales up to 2x). Big headings cap at the same 1.15 or lower.
const MOST = 1.15;

/** The app's text: React Native's, with the font-size cap. */
export function Text(props: ComponentProps<typeof RNText>) {
  return <RNText maxFontSizeMultiplier={MOST} {...props} />;
}

/** The app's text box: React Native's, with the font-size cap. */
export function TextInput(props: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput maxFontSizeMultiplier={MOST} {...props} />;
}
