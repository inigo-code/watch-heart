import type { UserList } from '@/lists/ListsProvider';
import type { Favourite } from '@/settings/SettingsProvider';
import type { Entry } from '@/store/types';
import { supabase } from '@/sync/supabase';

// Friends, through the functions in supabase/friends.sql: they check the friendship and return only what
// each person shares, so nothing here can read anyone's tables directly.

export type Friend = {
  id: string;
  name: string;
  bio: string;
  photoPath: string | null;
  favourites: Favourite[];
  since: string;
  /** Entries they share (0 when they keep their diary to themselves). */
  entries: number;
};

/** A friend's entry, as they share it (no "watched with" names or tags; no review unless shared). */
export type FriendEntry = Entry & { userId: string };

const client = () => {
  if (!supabase) throw new Error('Friends need an account, and this build has no sync set up.');
  return supabase;
};

/** The database's wording for problems we raise ourselves; anything else is a connection problem. */
function fail(e: { message?: string } | null): never {
  const m = e?.message ?? '';
  if (/Sign in first|No one has that code|own code|Too many wrong codes/.test(m)) throw new Error(m);
  if (/function .* does not exist|Could not find the function/i.test(m)) throw new Error('Friends aren’t set up on the server yet (supabase/friends.sql).');
  throw new Error(m || 'No connection. Try again in a moment.');
}

/** "K7QF29MZ" → "K7QF-29MZ", easier to read out. */
export const formatCode = (code: string) => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

export async function myInviteCode(reset = false): Promise<string> {
  const { data, error } = await client().rpc('my_invite_code', { reset });
  if (error) fail(error);
  return data as string;
}

/** Becomes friends with the code's owner; resolves to their account id. */
export async function redeemInvite(code: string): Promise<string> {
  const { data, error } = await client().rpc('redeem_invite', { invite: code });
  if (error) fail(error);
  if (!data) throw new Error('No one has that code. Check it and try again.');
  return data as string;
}

export async function removeFriend(id: string): Promise<void> {
  const { error } = await client().rpc('remove_friend', { friend: id });
  if (error) fail(error);
}

type FriendRow = { user_id: string; name: string; bio: string; photo_path: string | null; favourites: Favourite[] | null; since: string; entries: number };

export async function myFriends(): Promise<Friend[]> {
  const { data, error } = await client().rpc('my_friends');
  if (error) fail(error);
  return ((data ?? []) as FriendRow[]).map((r) => ({
    id: r.user_id,
    name: r.name || 'A friend',
    bio: r.bio,
    photoPath: r.photo_path,
    favourites: Array.isArray(r.favourites) ? r.favourites.slice(0, 4) : [],
    since: r.since,
    entries: Number(r.entries) || 0,
  }));
}

export async function friendDiary(id: string): Promise<FriendEntry[]> {
  const { data, error } = await client().rpc('friend_diary', { friend: id });
  if (error) fail(error);
  return ((data ?? []) as Entry[]).map((e) => ({ ...e, userId: id }));
}

/** A friend's lists as last fetched, for the list screen they open. */
export const friendListCache = new Map<string, UserList[]>();

export async function friendLists(id: string): Promise<UserList[]> {
  const { data, error } = await client().rpc('friend_lists', { friend: id });
  if (error) fail(error);
  return (data ?? []) as UserList[];
}

type EntryRow = { user_id: string; entry: Entry };

export async function friendsFeed(): Promise<FriendEntry[]> {
  const { data, error } = await client().rpc('friends_feed');
  if (error) fail(error);
  return ((data ?? []) as EntryRow[]).map((r) => ({ ...r.entry, userId: r.user_id }));
}

/** Friends' entries for one title. */
export async function titleFriends(source: string, sourceId: string): Promise<FriendEntry[]> {
  const { data, error } = await client().rpc('title_friends', { title_source: source, title_source_id: sourceId });
  if (error) fail(error);
  return ((data ?? []) as EntryRow[]).map((r) => ({ ...r.entry, userId: r.user_id }));
}

/** Friends' lists with this title on them. */
export async function titleInFriendLists(source: string, sourceId: string): Promise<(UserList & { userId: string })[]> {
  const { data, error } = await client().rpc('title_in_friend_lists', { title_source: source, title_source_id: sourceId });
  if (error) fail(error);
  return ((data ?? []) as { user_id: string; list: UserList }[]).map((r) => ({ ...r.list, userId: r.user_id }));
}

/** A short-lived link to a friend's photo (the bucket is private; friends may read each other's). */
export async function photoUrl(path: string): Promise<string | null> {
  const { data, error } = await client().storage.from('avatars').createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}
