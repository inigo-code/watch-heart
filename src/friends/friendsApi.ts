import type { UserList } from '@/lists/ListsProvider';
import type { Favourite } from '@/settings/SettingsProvider';
import type { Entry } from '@/store/types';
import { storage } from '@/lib/storage';
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
  sharesDiary: boolean;
};

/** A friend's entry, as they share it (no "watched with" names or tags; no review unless shared). */
export type FriendEntry = Entry & { userId: string };

const client = () => {
  if (!supabase) throw new Error('Friends aren’t available in this version of the app.');
  return supabase;
};

/** The database's wording for problems we raise ourselves; anything else is a connection problem. */
function fail(e: { message?: string } | null): never {
  const m = e?.message ?? '';
  if (/Sign in first|No one has that code|own code|Too many wrong codes/.test(m)) throw new Error(m);
  if (/function .* does not exist|Could not find the function/i.test(m)) throw new Error('Friends aren’t available right now. Try again later.');
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

type FriendRow = { shares_diary?: boolean; user_id: string; name: string; bio: string; photo_path: string | null; favourites: Favourite[] | null; since: string; entries: number };

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
    // Before friends-safety.sql runs, entries is the only clue.
    sharesDiary: r.shares_diary ?? Number(r.entries) > 0,
  }));
}

/** One page of a friend's diary, newest first. */
export async function friendDiary(id: string, from: number, count: number): Promise<FriendEntry[]> {
  const { data, error } = await client().rpc('friend_diary', { friend: id, max_rows: 2000 }).range(from, from + count - 1);
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

// Photo links are kept on the phone and reused while they have a day or more left. A new link on every
// launch meant each face waited on the server, and the phone's copy of the photo was never used.
// A new photo is a new path (avatar-<time>.jpg), so a kept link never shows an old one.
const LINKS_KEY = 'friend-photo-links';
const LINK_LIFE = 7 * 86_400; // seconds a link is signed for
const LINK_MARGIN = 86_400_000; // ms a kept link must still have left
type Links = Record<string, { url: string; until: number }>;
let kept: Promise<Links> | null = null;
const asking = new Map<string, Promise<string | null>>();

const keptLinks = () =>
  (kept ??= storage
    .getItem(LINKS_KEY)
    .then((raw) => (raw ? (JSON.parse(raw) as Links) : {}))
    .catch((): Links => ({})));

async function keep(path: string, url: string) {
  const now = Date.now();
  const next: Links = { [path]: { url, until: now + LINK_LIFE * 1000 } };
  // Drop links that are running out, and keep the list to the people you actually see.
  for (const [p, l] of Object.entries(await keptLinks()).slice(-199)) if (p !== path && l.until - now > LINK_MARGIN) next[p] = l;
  kept = Promise.resolve(next);
  storage.setItem(LINKS_KEY, JSON.stringify(next)).catch(() => {});
}

/** A link to a friend's photo (the bucket is private; friends may read each other's): the kept one, or a new one. */
export async function photoUrl(path: string): Promise<string | null> {
  const k = (await keptLinks())[path];
  if (k && k.until - Date.now() > LINK_MARGIN) return k.url;
  let p = asking.get(path);
  if (!p) {
    p = client()
      .storage.from('avatars')
      .createSignedUrl(path, LINK_LIFE)
      .then(async ({ data, error }) => {
        if (error || !data) return null;
        await keep(path, data.signedUrl);
        return data.signedUrl;
      })
      .finally(() => asking.delete(path));
    asking.set(path, p);
  }
  return p;
}

// --- Finding people by name (supabase/people.sql) ----------------------------------------------------

/** Someone found by name: who they are, and where a request between you stands. */
export type Person = { id: string; name: string; bio: string; status: 'none' | 'sent' | 'received'; photoPath: string | null; previewable: boolean };
export type FriendRequest = { id: string; name: string; bio: string; sentAt: string; photoPath: string | null };
/** A look at someone before you're friends. Never their diary, reviews or lists. */
export type PersonPreview = { id: string; name: string; bio: string; photoPath: string | null; favourites: Favourite[]; titles: number; status: Person['status'] | 'friends' };
export type Blocked = { id: string; name: string };

/** The server hasn't had supabase/people.sql run yet. Never shown: name search stays hidden instead. */
class PeopleNotSetUp extends Error {}

/** True when the server hasn't had supabase/people.sql run yet (name search then stays hidden). */
export const notSetUp = (e: unknown) => e instanceof PeopleNotSetUp;

function failPeople(e: { message?: string } | null): never {
  const m = e?.message ?? '';
  if (/function .* does not exist|Could not find the function/i.test(m)) throw new PeopleNotSetUp('Finding people isn’t available right now. Try again later.');
  fail(e);
}

export async function searchPeople(q: string): Promise<Person[]> {
  const { data, error } = await client().rpc('search_people', { q });
  if (error) failPeople(error);
  type Row = { user_id: string; name: string; bio: string; status: Person['status']; photo_path?: string | null; previewable?: boolean };
  return ((data ?? []) as Row[]).map((r) => ({ id: r.user_id, name: r.name, bio: r.bio, status: r.status, photoPath: r.photo_path ?? null, previewable: !!r.previewable }));
}

/** Someone you might know: how many friends you share, and how many titles in common (never which). */
export type Suggestion = Person & { mutual: number; common: number };

/** People you might know (supabase/suggestions.sql). Empty, not an error, before that has been run. */
export async function suggestPeople(): Promise<Suggestion[]> {
  const { data, error } = await client().rpc('suggest_people');
  if (error) {
    if (/function .* does not exist|Could not find the function/i.test(error.message ?? '')) return [];
    fail(error);
  }
  type Row = { user_id: string; name: string; bio: string; status: Person['status']; photo_path?: string | null; previewable?: boolean; mutual: number; common: number };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.user_id,
    name: r.name,
    bio: r.bio,
    status: r.status,
    photoPath: r.photo_path ?? null,
    previewable: !!r.previewable,
    mutual: Number(r.mutual) || 0,
    common: Number(r.common) || 0,
  }));
}

/** Resolves to 'sent', or 'friends' when they had already asked you. */
export async function sendFriendRequest(id: string): Promise<'sent' | 'friends'> {
  const { data, error } = await client().rpc('send_friend_request', { target: id });
  if (error) failPeople(error);
  return data as 'sent' | 'friends';
}

export async function friendRequests(): Promise<FriendRequest[]> {
  const { data, error } = await client().rpc('my_friend_requests');
  if (error) failPeople(error);
  type Row = { user_id: string; name: string; bio: string; sent_at: string; photo_path?: string | null };
  return ((data ?? []) as Row[]).map((r) => ({ id: r.user_id, name: r.name || 'Someone', bio: r.bio, sentAt: r.sent_at, photoPath: r.photo_path ?? null }));
}

export async function answerFriendRequest(id: string, accept: boolean): Promise<void> {
  const { error } = await client().rpc('answer_friend_request', { requester: id, accept });
  if (error) failPeople(error);
}

export async function cancelFriendRequest(id: string): Promise<void> {
  const { error } = await client().rpc('cancel_friend_request', { target: id });
  if (error) failPeople(error);
}

// --- Blocking and previews (supabase/friends-safety.sql) -----------------------------------------------

function failSafety(e: { message?: string } | null): never {
  const m = e?.message ?? '';
  if (/function .* does not exist|Could not find the function/i.test(m)) throw new Error('That isn’t available right now. Try again later.');
  fail(e);
}

/** Who someone is, or null when they don't show it to you. */
export async function personPreview(id: string): Promise<PersonPreview | null> {
  const { data, error } = await client().rpc('person_preview', { target: id });
  if (error) failSafety(error);
  type Row = { user_id: string; name: string; bio: string; photo_path: string | null; favourites: Favourite[] | null; titles: number; status: PersonPreview['status'] };
  const r = ((data ?? []) as Row[])[0];
  if (!r) return null;
  return { id: r.user_id, name: r.name || 'Someone', bio: r.bio, photoPath: r.photo_path, favourites: Array.isArray(r.favourites) ? r.favourites.slice(0, 4) : [], titles: Number(r.titles) || 0, status: r.status };
}

export async function blockPerson(id: string): Promise<void> {
  const { error } = await client().rpc('block_person', { target: id });
  if (error) failSafety(error);
}

export async function unblockPerson(id: string): Promise<void> {
  const { error } = await client().rpc('unblock_person', { target: id });
  if (error) failSafety(error);
}

export async function myBlocks(): Promise<Blocked[]> {
  const { data, error } = await client().rpc('my_blocks');
  if (error) failSafety(error);
  return ((data ?? []) as { user_id: string; name: string }[]).map((r) => ({ id: r.user_id, name: r.name || 'Someone' }));
}
