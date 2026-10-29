-- Watch Heart: your own lists ("Best of 2026", "Ghibli ranked"), synced across devices.
-- Paste into Supabase Dashboard -> SQL Editor -> New query, then Run. Safe to run more than once.
-- (Also part of schema.sql, for new projects.)

create table if not exists public.lists (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  -- The list as the app keeps it: name, description, ranked, items.
  data jsonb not null default '{}',
  modified_at bigint not null,
  removed boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

-- The same last-write-wins rule as the diary (sync_lww in schema.sql).
drop trigger if exists lists_sync_lww on public.lists;
create trigger lists_sync_lww before insert or update on public.lists
  for each row execute function public.sync_lww();

alter table public.lists enable row level security;
drop policy if exists "own lists" on public.lists;
create policy "own lists" on public.lists
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Live updates between devices.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lists') then
    alter publication supabase_realtime add table public.lists;
  end if;
end;
$$;
