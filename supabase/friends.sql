-- Watch Heart: friends by invite code, and what friends can see of each other.
-- Paste into Supabase Dashboard -> SQL Editor -> New query, then Run. Safe to run more than once.
-- (Also part of schema.sql, for new projects.)
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
