import { File } from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { EXPORT_H, EXPORT_W } from './export';
import type { StoryHandle } from './StoryCanvas';

/** Draws the story into a 1440×2560 PNG (a sharper Instagram story size) and returns its file uri. */
export async function captureStory(ref: RefObject<StoryHandle | null>): Promise<string> {
  if (!ref.current) throw new Error('The story isn’t ready yet.');
  return captureRef(ref, { format: 'png', quality: 1, width: EXPORT_W, height: EXPORT_H, result: 'tmpfile' });
}

/** Watch Heart's Meta app (developers.facebook.com). Instagram wants it on every story shared to it; it isn't secret. */
const META_APP_ID = '1513214237381567';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

/**
 * Opens the image straight in Instagram's story editor. Instagram decides by itself whether "Story" shows in
 * the share sheet, and on some phones it doesn't, so this asks for the story directly. Without Instagram, or
 * if it turns the image away, the share sheet opens instead.
 */
export async function shareToStory(uri: string) {
  if (Platform.OS === 'android') {
    try {
      await startActivityAsync('com.instagram.share.ADD_TO_STORY', {
        data: new File(uri).contentUri,
        type: 'image/png',
        flags: FLAG_GRANT_READ_URI_PERMISSION,
        extra: { source_application: META_APP_ID },
      });
      return;
    } catch {
      // Instagram isn't on this phone: the share sheet below still works.
    }
  }
  await shareImage(uri);
}

/** Opens the share sheet with the image, for WhatsApp status, Snapchat or any other app. */
export async function shareImage(uri: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your story', UTI: 'public.png' });
}

/**
 * Saves the image to the phone's Pictures. On Android 10+ this needs no photo permission at all (the app
 * only adds a file); older Android asks for storage access once.
 */
export async function saveImage(uri: string) {
  if (Platform.OS === 'web') throw new Error('Saving to photos works in the Android app.');
  const permission = await requestPermissionsAsync(true, []);
  if (!permission.granted) throw new Error('Allow Watch Heart to save photos, then try again.');
  await Asset.create(uri);
}
