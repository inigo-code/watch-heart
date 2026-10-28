import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

// The profile photo: picked with the system photo picker (no permission needed), cropped square and made
// small (512 px JPEG, about 50 KB) so it syncs in a moment. The same approach as Prompt Heart's images.

const SIZE = 512;
const QUALITY = 0.85;

/** Lets you pick a photo and crop it square; returns the small copy in the app's files, or null if cancelled. */
export async function pickProfilePhoto(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (res.canceled || !res.assets?.[0]) return null;
  return squareJpeg(res.assets[0].uri);
}

/** A centred square of the image, at most 512 px, as a JPEG kept in the app's own files. */
export async function squareJpeg(uri: string): Promise<string> {
  const probe = await ImageManipulator.manipulate(uri).renderAsync();
  const side = Math.min(probe.width, probe.height);
  const ctx = ImageManipulator.manipulate(uri);
  if (probe.width !== probe.height) {
    ctx.crop({ originX: Math.floor((probe.width - side) / 2), originY: Math.floor((probe.height - side) / 2), width: side, height: side });
  }
  if (side > SIZE) ctx.resize({ width: SIZE, height: SIZE });
  const saved = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: QUALITY });
  if (Platform.OS === 'web') return saved.uri;
  // Out of the cache, into the app's files, with a new name each time so every screen shows the new one.
  const dest = new File(Paths.document, `profile-${Date.now()}.jpg`);
  new File(saved.uri).copy(dest);
  return dest.uri;
}

/** A saved photo too big to sync, from before photos were made small. */
export function needsShrinking(uri: string | null): boolean {
  if (!uri || !uri.startsWith('file:')) return false;
  try {
    return (new File(uri).size ?? 0) > 400_000;
  } catch {
    return false;
  }
}

/** Removes an old photo from the app's files (never anything outside them). */
export function removePhotoFile(uri: string | null) {
  if (!uri || !uri.startsWith(Paths.document.uri)) return;
  try {
    new File(uri).delete();
  } catch {}
}
