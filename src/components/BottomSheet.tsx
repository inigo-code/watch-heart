import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { KeyboardSafe } from '@/components/KeyboardSafe';

/**
 * A sheet that rises from the bottom over a dimmed screen: the dim fades in while the sheet springs up, and
 * both run backwards on close (a modal's own "slide" would carry the dim up with the sheet). Room is made for
 * the keyboard. Children draw the sheet itself (its background, corners and padding).
 */
export function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const { height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  // Stays mounted while it slides away.
  const [shown, setShown] = useState(visible);
  if (visible && !shown) setShown(true);

  useEffect(() => {
    if (visible) {
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 24, stiffness: 260, mass: 0.9 }).start();
    } else {
      Animated.timing(progress, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setShown(false);
      });
    }
  }, [visible, progress]);

  const rise = progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
  return (
    <Modal visible={shown} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardSafe style={styles.bottom}>
        <Animated.View style={{ transform: [{ translateY: rise }] }}>{children}</Animated.View>
      </KeyboardSafe>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(0,0,0,0.5)' },
  // Taps outside the sheet reach the dim behind it.
  bottom: { justifyContent: 'flex-end', pointerEvents: 'box-none' },
});
