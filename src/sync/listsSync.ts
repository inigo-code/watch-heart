import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserList } from '@/lists/ListsProvider';

// Lists in the cloud: one "lists" row per list (the list as JSON), the same last-write-wins rule as the
// diary. Lists are few, so each sync reads them all; only changed ones are sent.

type Row = { id: string; data: Partial<UserList> | null; modified_at: number | string; removed: boolean };

/**
 * Sends lists changed here, then reads the cloud's. With `fresh` (a new account on this phone), every
 * list counts as changed. Returns what came back and what was sent, for applySync.
 */
export async function syncLists(client: SupabaseClient, userId: string, mine: UserList[], fresh: boolean) {
  const toSend = mine.filter((l) => fresh || l.updatedAt > l.syncedAt);
  if (toSend.length) {
    const rows = toSend.map((l) => ({
      user_id: userId,
      id: l.id,
      data: l.deletedAt ? {} : { ...l, syncedAt: undefined },
      modified_at: l.updatedAt,
      removed: !!l.deletedAt,
    }));
    const { error } = await client.from('lists').upsert(rows, { onConflict: 'user_id,id' });
    if (error) throw error;
  }
  const { data, error } = await client.from('lists').select('id, data, modified_at, removed').eq('user_id', userId);
  if (error) throw error;
  const incoming: UserList[] = (data as Row[]).map((r) => {
    const d = r.data ?? {};
    const at = Number(r.modified_at);
    return {
      id: r.id,
      name: d.name ?? 'Untitled list',
      description: d.description ?? '',
      ranked: !!d.ranked,
      items: Array.isArray(d.items) ? d.items : [],
      createdAt: d.createdAt ?? at,
      updatedAt: at,
      deletedAt: r.removed ? at : null,
      syncedAt: at,
    };
  });
  return { incoming, sent: toSend.map((l) => ({ id: l.id, updatedAt: l.updatedAt })) };
}
