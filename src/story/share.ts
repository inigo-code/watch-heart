import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { EXPORT_H, EXPORT_W, PX_PER_POINT } from './export';
import type { StoryHandle } from './StoryCanvas';

/** Draws the story into a 1440×2560 PNG (a sharper Instagram story size) and returns its file uri. */
export async function captureStory(ref: RefObject<StoryHandle | null>): Promise<string> {
  if (!ref.current) throw new Error('The story isn’t ready yet.');
  return captureRef(ref, { format: 'png', quality: 1, width: EXPORT_W, height: EXPORT_H, result: 'tmpfile' });
}

/** Draws a `w`×`h`-point image (a ticket) into a PNG at four pixels a point and returns its file uri. */
export async function captureImage(ref: RefObject<StoryHandle | null>, w: number, h: number): Promise<string> {
  if (!ref.current) throw new Error('The image isn’t ready yet.');
  return captureRef(ref, { format: 'png', quality: 1, width: w * PX_PER_POINT, height: h * PX_PER_POINT, result: 'tmpfile' });
}

/**
 * Opens the share sheet with the image. Choose Instagram, then Story, to post it; it works the same for
 * WhatsApp status, Snapchat or anything else. (Instagram's direct "share to story" intent needs a Meta
 * developer app id; the share sheet needs nothing.)
 */
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
