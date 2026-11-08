import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

// A photo for a memory story: picked with the system photo picker (no permission needed), cropped to the
// frame and made 1080 px wide, which is as sharp as the story gets. It stays in the cache: the story keeps
// the picture, the diary doesn't.

const WIDTH = 1080;

/** Lets you pick a photo and crop it to the memory frame; null if cancelled. */
export async function pickMemoryPhoto(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 1 });
  const asset = res.canceled ? null : res.assets?.[0];
  if (!asset) return null;
  const ctx = ImageManipulator.manipulate(asset.uri);
  if ((asset.width ?? 0) > WIDTH) ctx.resize({ width: WIDTH });
  const saved = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return saved.uri;
}
