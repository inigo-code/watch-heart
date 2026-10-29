import type { ComponentRef, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * A screen (or sheet) that makes room for the keyboard: it measures how far the keyboard covers it and adds
 * that much space at the bottom, so the field you're typing in and the buttons under it stay in view.
 *
 * Android apps now draw edge to edge, so the window no longer shrinks for the keyboard; React Native's
 * KeyboardAvoidingView only measures against its parent, which goes wrong under a header or in a sheet.
 * Measuring in window coordinates works the same everywhere.
 */
export function KeyboardSafe({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [room, setRoom] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      // The padding sits inside the view, so its measured size doesn't change as the keyboard comes and goes.
      ref.current?.measureInWindow((_x, y, _w, h) => setRoom(Math.max(0, y + h - e.endCoordinates.screenY)));
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setRoom(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View ref={ref} style={[{ flex: 1 }, style, room > 0 && { paddingBottom: room }]}>
      {children}
    </View>
  );
}
