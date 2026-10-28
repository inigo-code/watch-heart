import type { SupabaseClient } from '@supabase/supabase-js';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { Favourite, Settings } from '@/settings/SettingsProvider';

// The profile is one record per account: the "profiles" row (name, bio, favourites, goal) and a small
// JPEG in the private "avatars" bucket, under the account's own folder. Newest edit wins, like the diary.

type ProfileData = { name: string; bio: string; favourites: Favourite[]; yearGoal: number };
type ProfileRow = { data: Partial<ProfileData> | null; photo_path: string | null; modified_at: number | string };

const BUCKET = 'avatars';
// Photos live in files on the phone; the web preview keeps its photo to itself.
const photos = Platform.OS !== 'web';

/** Whether this phone has a profile worth sending (anything filled in). */
export const hasProfile = (s: Settings) => !!(s.name.trim() || s.bio.trim() || s.photo || s.favourites.length || s.yearGoal);

/** What changes in settings when the cloud's profile is newer than this phone's (null: nothing to do). */
export async function pullProfile(client: SupabaseClient, userId: string, s: Settings): Promise<Partial<Settings> | null> {
  const { data, error } = await client.from('profiles').select('data, photo_path, modified_at').eq('user_id', userId).maybeSingle<ProfileRow>();
  if (error) throw error;
  if (!data) return null;
  const at = Number(data.modified_at);
  if (at <= s.profileUpdatedAt) return null;

  const d = data.data ?? {};
  const patch: Partial<Settings> = {
    name: d.name ?? s.name,
    bio: d.bio ?? s.bio,
    favourites: Array.isArray(d.favourites) ? d.favourites.slice(0, 4) : s.favourites,
    yearGoal: typeof d.yearGoal === 'number' ? d.yearGoal : s.yearGoal,
    profileUpdatedAt: at,
    profileSyncedAt: at,
  };
  if (photos && data.photo_path !== s.photoPath) {
    if (!data.photo_path) {
      patch.photo = null;
      patch.photoPath = null;
    } else {
      const { data: signed, error: urlError } = await client.storage.from(BUCKET).createSignedUrl(data.photo_path, 120);
      if (urlError) throw urlError;
      const file = await File.downloadFileAsync(signed.signedUrl, new File(Paths.document, `profile-${Date.now()}.jpg`));
      patch.photo = file.uri;
      patch.photoPath = data.photo_path;
    }
    removeLocal(s.photo);
  }
  return patch;
}

/** Sends this phone's profile (and its photo, if new); returns what to record in settings. */
export async function pushProfile(client: SupabaseClient, userId: string, s: Settings): Promise<Partial<Settings>> {
  let photoPath = s.photoPath;
  if (photos) {
    if (s.photo && !photoPath) {
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const bytes = await new File(s.photo).bytes();
      const { error } = await client.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      photoPath = path;
    } else if (!s.photo) photoPath = null;
  }
  const data: ProfileData = { name: s.name, bio: s.bio, favourites: s.favourites, yearGoal: s.yearGoal };
  // A profile made before sync existed has no stamp yet; 1 still loses to any real edit elsewhere.
  const at = s.profileUpdatedAt || 1;
  const { error } = await client.from('profiles').upsert({ user_id: userId, data, photo_path: photoPath, modified_at: at }, { onConflict: 'user_id' });
  if (error) throw error;
  // Older photos in the account's folder aren't needed any more.
  if (photos) await removeRemote(client, userId, photoPath).catch(() => {});
  return { photoPath, profileSyncedAt: at };
}

/** Removes the account's photos from the cloud, keeping `keep` (for account deletion: keep nothing). */
export async function removeRemote(client: SupabaseClient, userId: string, keep: string | null = null) {
  const { data, error } = await client.storage.from(BUCKET).list(userId);
  if (error) throw error;
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await client.storage.from(BUCKET).remove(old);
}

function removeLocal(uri: string | null) {
  if (!uri || !uri.startsWith(Paths.document.uri)) return;
  try {
    new File(uri).delete();
  } catch {}
}
