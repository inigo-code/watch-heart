import { File, Paths } from 'expo-file-system';
import { useRef } from 'react';
import type { ComponentRef } from 'react';
// React Native's Image, not expo-image: it has to be drawn before the capture (see StoryCanvas).
import { Image, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

const SIZE = 512;

/**
 * Turns a picked photo into a small square JPEG for the profile (about 50 KB instead of a few MB): the
 * photo is drawn, cropped to a square, behind the screen and captured at 512 px. Without a native image
 * library, this is the one way the installed app can resize.
 */
export function PhotoShrinker({ source, onDone, onFail }: { source: string; onDone: (uri: string) => void; onFail: (e: unknown) => void }) {
  const frame = useRef<ComponentRef<typeof View>>(null);
  const shrink = async () => {
    try {
      const tmp = await captureRef(frame, { format: 'jpg', quality: 0.85, width: SIZE, height: SIZE, result: 'tmpfile' });
      const dest = new File(Paths.document, `profile-${Date.now()}.jpg`);
      new File(tmp).copy(dest);
      onDone(dest.uri);
    } catch (e) {
      onFail(e);
    }
  };
  return (
    <View ref={frame} collapsable={false} pointerEvents="none" style={styles.frame}>
      <Image source={{ uri: source }} style={styles.photo} resizeMode="cover" onLoad={() => setTimeout(shrink, 50)} onError={() => onFail(new Error('The picture couldn’t be opened.'))} />
    </View>
  );
}

/** A saved photo too big to sync, from before photos were shrunk. */
export function needsShrinking(uri: string | null): boolean {
  if (!uri || !uri.startsWith('file:')) return false;
  try {
    return (new File(uri).size ?? 0) > 400_000;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  // Behind the screen's own background, so it's drawn but never seen.
  frame: { position: 'absolute', top: 0, left: 0, width: 320, height: 320, zIndex: -1 },
  photo: { width: '100%', height: '100%' },
});
