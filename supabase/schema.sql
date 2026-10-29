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


-- ---------------------------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- { name, bio, favourites, yearGoal }, exactly as the app keeps them.
  data jsonb not null default '{}',
  -- Where the photo is in the "avatars" bucket (null = no photo).
  photo_path text,
  modified_at bigint not null,
  server_updated_at timestamptz not null default clock_timestamp()
);

-- The same last-write-wins rule as the diary (sync_lww in schema.sql).
drop trigger if exists profiles_sync_lww on public.profiles;
create trigger profiles_sync_lww before insert or update on public.profiles
  for each row execute function public.sync_lww();

alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Live updates, so a new photo or name shows on your other devices.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;

-- Profile photos: a private bucket, one folder per account (avatars/<user id>/...), small JPEGs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

drop policy if exists "own avatar read" on storage.objects;
create policy "own avatar read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own avatar write" on storage.objects;
create policy "own avatar write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own avatar update" on storage.objects;
create policy "own avatar update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own avatar delete" on storage.objects;
create policy "own avatar delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------------------------
--
-- How it's private:
--   * Each account has one invite code. Entering someone's code makes you friends both ways; either of
--     you can unfriend, and resetting your code stops it working for anyone new.
--   * Friends never read each other's tables. The diary, watchlist, lists and profiles keep their
--     "own rows only" policies; friends see each other only through the functions below, which check the
--     friendship and return just what each person shares (profiles.data.sharing: diary, reviews, lists,
--     all on unless switched off). "Watched with" names and tags are never shared.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.invite_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;
drop policy if exists "own code" on public.invite_codes;
create policy "own code" on public.invite_codes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.friendships (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
alter table public.friendships enable row level security;
drop policy if exists "own friendships" on public.friendships;
create policy "own friendships" on public.friendships
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Wrong codes, to slow down guessing (10 an hour). Only the functions use it.
create table if not exists public.invite_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists invite_attempts_user_at on public.invite_attempts (user_id, at);
alter table public.invite_attempts enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Helpers

create or replace function public.is_friend(other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.friendships where user_id = (select auth.uid()) and friend_id = other);
$$;

-- What someone shares: diary, reviews, lists (each on unless they turned it off).
create or replace function public.shares(owner uuid, what text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select (p.data -> 'sharing' ->> what)::boolean from public.profiles p where p.user_id = owner), true);
$$;

-- A diary entry as a friend sees it: no "watched with" names or tags, and no review unless shared.
create or replace function public.entry_for_friends(owner uuid, entry jsonb)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case
    when public.shares(owner, 'reviews') then entry - 'companions' - 'tags'
    else (entry - 'companions' - 'tags' - 'review') || '{"review": "", "spoilers": false}'::jsonb
  end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Codes and friendships

-- Your invite code (made the first time); with reset, a new one, and the old one stops working.
create or replace function public.my_invite_code(reset boolean default false)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I/L
  c text;
  b bytea;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if not reset then
    select code into c from public.invite_codes where user_id = uid;
    if c is not null then return c; end if;
  end if;
  loop
    b := extensions.gen_random_bytes(8);
    c := '';
    for i in 0..7 loop
      c := c || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.invite_codes where code = c);
  end loop;
  insert into public.invite_codes (user_id, code) values (uid, c)
    on conflict (user_id) do update set code = excluded.code, created_at = now();
  return c;
end;
$$;

-- Become friends with whoever owns this code (both ways). Returns their account id, or null when no one
-- has that code (returned, not raised: raising would undo the record of the wrong guess).
create or replace function public.redeem_invite(invite text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean text := upper(regexp_replace(coalesce(invite, ''), '[^A-Za-z0-9]', '', 'g'));
  owner uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if (select count(*) from public.invite_attempts where user_id = uid and at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many wrong codes. Try again in an hour.';
  end if;
  select user_id into owner from public.invite_codes where code = clean;
  if owner is null then
    insert into public.invite_attempts (user_id) values (uid);
    return null;
  end if;
  if owner = uid then raise exception 'That’s your own code.'; end if;
  insert into public.friendships (user_id, friend_id) values (uid, owner), (owner, uid) on conflict do nothing;
  return owner;
end;
$$;

-- Unfriend, both ways.
create or replace function public.remove_friend(friend uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.friendships
  where (user_id = (select auth.uid()) and friend_id = friend) or (user_id = friend and friend_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------------------------
-- What friends see

-- Your friends: name, bio, photo, favourites, and what they share.
create or replace function public.my_friends()
returns table (user_id uuid, name text, bio text, photo_path text, favourites jsonb, since timestamptz, entries bigint)
language sql stable security definer set search_path = ''
as $$
  select f.friend_id,
         coalesce(p.data ->> 'name', ''),
         coalesce(p.data ->> 'bio', ''),
         p.photo_path,
         coalesce(p.data -> 'favourites', '[]'::jsonb),
         f.created_at,
         case when public.shares(f.friend_id, 'diary')
           then (select count(*) from public.entries e where e.user_id = f.friend_id and not e.removed and e.data ->> 'deletedAt' is null)
           else 0 end
  from public.friendships f
  left join public.profiles p on p.user_id = f.friend_id
  where f.user_id = (select auth.uid())
  order by f.created_at desc;
$$;

-- A friend's diary, newest first.
create or replace function public.friend_diary(friend uuid, max_rows int default 500)
returns setof jsonb
language sql stable security definer set search_path = ''
as $$
  select public.entry_for_friends(friend, e.data)
  from public.entries e
  where public.is_friend(friend) and public.shares(friend, 'diary')
    and e.user_id = friend and not e.removed and e.data ->> 'deletedAt' is null
  order by e.data ->> 'watchedOn' desc, e.modified_at desc
  limit least(max_rows, 2000);
$$;

-- A friend's lists.
create or replace function public.friend_lists(friend uuid)
returns setof jsonb
language sql stable security definer set search_path = ''
as $$
  select l.data
  from public.lists l
  where public.is_friend(friend) and public.shares(friend, 'lists')
    and l.user_id = friend and not l.removed and l.data ->> 'deletedAt' is null
  order by l.modified_at desc;
$$;

-- What your friends have watched lately, across all of them.
create or replace function public.friends_feed(max_rows int default 60)
returns table (user_id uuid, entry jsonb)
language sql stable security definer set search_path = ''
as $$
  select e.user_id, public.entry_for_friends(e.user_id, e.data)
  from public.entries e
  join public.friendships f on f.friend_id = e.user_id and f.user_id = (select auth.uid())
  where public.shares(e.user_id, 'diary') and not e.removed and e.data ->> 'deletedAt' is null
    and coalesce((e.data ->> 'undated')::boolean, false) = false
  order by e.data ->> 'watchedOn' desc, e.modified_at desc
  limit least(max_rows, 200);
$$;

-- Friends who logged this title, with their entries.
create or replace function public.title_friends(title_source text, title_source_id text)
returns table (user_id uuid, entry jsonb)
language sql stable security definer set search_path = ''
as $$
  select e.user_id, public.entry_for_friends(e.user_id, e.data)
  from public.entries e
  join public.friendships f on f.friend_id = e.user_id and f.user_id = (select auth.uid())
  where public.shares(e.user_id, 'diary') and not e.removed and e.data ->> 'deletedAt' is null
    and e.data ->> 'source' = title_source and e.data ->> 'sourceId' = title_source_id
  order by e.data ->> 'watchedOn' desc;
$$;

-- Friends' lists with this title on them.
create or replace function public.title_in_friend_lists(title_source text, title_source_id text)
returns table (user_id uuid, list jsonb)
language sql stable security definer set search_path = ''
as $$
  select l.user_id, l.data
  from public.lists l
  join public.friendships f on f.friend_id = l.user_id and f.user_id = (select auth.uid())
  where public.shares(l.user_id, 'lists') and not l.removed and l.data ->> 'deletedAt' is null
    and exists (
      select 1 from jsonb_array_elements(coalesce(l.data -> 'items', '[]'::jsonb)) i
      where i ->> 'source' = title_source and i ->> 'sourceId' = title_source_id
    );
$$;

-- Only signed-in accounts can call these; the helpers aren't called directly.
do $$
declare fn text;
begin
  foreach fn in array array[
    'my_invite_code(boolean)', 'redeem_invite(text)', 'remove_friend(uuid)', 'my_friends()', 'friend_diary(uuid, int)',
    'friend_lists(uuid)', 'friends_feed(int)', 'title_friends(text, text)', 'title_in_friend_lists(text, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  foreach fn in array array['is_friend(uuid)', 'shares(uuid, text)', 'entry_for_friends(uuid, jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;

-- Friends can see each other's profile photo (the "avatars" bucket stays private to everyone else).
drop policy if exists "friends read avatars" on storage.objects;
create policy "friends read avatars" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.is_friend(((storage.foldername(name))[1])::uuid));
