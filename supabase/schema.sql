-- Watch Heart: accounts and cloud sync.
-- Paste into Supabase Dashboard -> SQL Editor -> New query, then Run. Safe to run more than once.
--
-- Sync model (the same as Prompt Heart's):
--   * Records keep their client-generated ids; (user_id, id) is the primary key.
--   * Each diary entry and watchlist item is one JSON document (`data`), exactly as the app keeps it,
--     so new fields in the app need no change here.
--   * Deletes are tombstones (`removed`), so other devices learn about them. Moving an entry to Trash
--     is just an edit (its data has deletedAt); `removed` means deleted for good.
--   * Conflicts resolve last-write-wins on modified_at (client ms timestamp): an incoming write that
--     isn't newer than what's stored is silently ignored.
--   * server_updated_at is set by the server and is what devices pull from.

create table if not exists public.entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null default '{}',
  modified_at bigint not null,
  removed boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table if not exists public.watchlist (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null default '{}',
  modified_at bigint not null,
  removed boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create index if not exists entries_pull_idx on public.entries (user_id, server_updated_at);
create index if not exists watchlist_pull_idx on public.watchlist (user_id, server_updated_at);

-- Last-write-wins, and the server's own timestamp for pulling.
create or replace function public.sync_lww()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.modified_at <= old.modified_at then
    return null; -- the stored row is the same or newer: keep it (this also stops echo loops)
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists entries_sync_lww on public.entries;
create trigger entries_sync_lww before insert or update on public.entries
  for each row execute function public.sync_lww();

drop trigger if exists watchlist_sync_lww on public.watchlist;
create trigger watchlist_sync_lww before insert or update on public.watchlist
  for each row execute function public.sync_lww();

-- Row Level Security: each user can only see and write their own rows.
alter table public.entries enable row level security;
alter table public.watchlist enable row level security;

drop policy if exists "own entries" on public.entries;
create policy "own entries" on public.entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own watchlist" on public.watchlist;
create policy "own watchlist" on public.watchlist
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Live updates between devices.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'entries') then
    alter publication supabase_realtime add table public.entries;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'watchlist') then
    alter publication supabase_realtime add table public.watchlist;
  end if;
end;
$$;

-- In-app "Delete account": lets a signed-in user delete their own account and nothing else
-- (auth.uid() is the caller). Their diary and watchlist go with it (ON DELETE CASCADE).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

