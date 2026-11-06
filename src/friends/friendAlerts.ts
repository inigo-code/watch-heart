import { storage } from '@/lib/storage';

// Which requests and friends this phone already knows about, so the background check only mentions new ones.

const KEY = 'watchheart/friend-alerts';

type Who = { id: string; name: string };
type Seen = { requests: string[]; friends: string[] };
export type FriendNews = { id: string; title: string; body: string };

/** New requests, and people who became friends since. Someone you just asked and who said yes is the second. */
export function whatsNew(seen: Seen, requests: Who[], friends: Who[]): FriendNews[] {
  const asked = requests
    .filter((r) => !seen.requests.includes(r.id))
    .map((r) => ({ id: `friend-request-${r.id}`, title: 'Friend request', body: `${r.name} wants to be friends` }));
  const joined = friends
    .filter((f) => !seen.friends.includes(f.id))
    .map((f) => ({ id: `friend-new-${f.id}`, title: 'New friend', body: `You and ${f.name} are friends now` }));
  return [...asked, ...joined];
}

/** Marks these as known. The app does this whenever it loads them, so what you've seen is never announced. */
export async function rememberFriends(requests: { id: string }[], friends: { id: string }[]) {
  const seen: Seen = { requests: requests.map((r) => r.id), friends: friends.map((f) => f.id) };
  await storage.setItem(KEY, JSON.stringify(seen));
}

/** What's new since last time, and remembers it. The first time there's nothing to compare, so nothing is new. */
export async function friendNews(requests: Who[], friends: Who[]): Promise<FriendNews[]> {
  const raw = await storage.getItem(KEY);
  await rememberFriends(requests, friends);
  return raw ? whatsNew(JSON.parse(raw) as Seen, requests, friends) : [];
}
