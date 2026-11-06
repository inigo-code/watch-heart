-- Watch Heart: blocking, a final unfriend, fair requests, and a look at someone before you add them.
-- Paste into Supabase Dashboard -> SQL Editor -> New query, then Run. Safe to run more than once.
-- Needs friends.sql, profile.sql and people.sql first. Run this before the app update that uses it;
-- the app keeps working without it, and older versions of the app keep working with it.
--
-- What it changes:
--   * Block: ends a friendship and any requests, and stops that person finding, asking or adding you.
--   * Unfriend is final: the person you removed can't come back with your old code. A new code, or you
--     adding them again, clears that.
--   * Declining means that person can't ask again for 30 days. They aren't told why.
--   * The limit of 30 requests a day can't be dodged by cancelling.
--   * A preview shows photo, bio, favourite four and how many titles someone has logged. Never their
--     diary, reviews or lists. Only for people who turned on "Show my profile in search"
--     (profiles.data.sharing.preview, off by default), friends, and anyone who has asked to be your friend.

create table if not exists public.friend_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists friend_blocks_blocked on public.friend_blocks (blocked_id);
alter table public.friend_blocks enable row level security;

-- Who you unfriended. Only the functions read these three tables.
create table if not exists public.friend_removals (
  by_id uuid not null references auth.users (id) on delete cascade,
  who_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (by_id, who_id)
);
alter table public.friend_removals enable row level security;

create table if not exists public.friend_declines (
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);
alter table public.friend_declines enable row level security;

create table if not exists public.friend_request_log (
  from_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists friend_request_log_from on public.friend_request_log (from_id, created_at);
alter table public.friend_request_log enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Helpers

create or replace function public.blocked_between(one uuid, other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friend_blocks b
    where (b.blocker_id = one and b.blocked_id = other) or (b.blocker_id = other and b.blocked_id = one)
  );
$$;

-- Whether someone chose to show their profile in search.
create or replace function public.previewable(owner uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.findable(owner)
    and coalesce((select (p.data -> 'sharing' ->> 'preview')::boolean from public.profiles p where p.user_id = owner), false);
$$;

-- Whether you may see someone's preview and photo.
create or replace function public.can_preview(owner uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not public.blocked_between((select auth.uid()), owner)
    and (
      owner = (select auth.uid())
      or public.is_friend(owner)
      or exists (select 1 from public.friend_requests r where r.from_id = owner and r.to_id = (select auth.uid()))
      or public.previewable(owner)
    );
$$;

-- Becoming friends clears what stood between two people.
create or replace function public.befriend(one uuid, other uuid)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.friendships (user_id, friend_id) values (one, other), (other, one) on conflict do nothing;
  delete from public.friend_requests where (from_id = one and to_id = other) or (from_id = other and to_id = one);
  delete from public.friend_removals where (by_id = one and who_id = other) or (by_id = other and who_id = one);
  delete from public.friend_declines where (from_id = one and to_id = other) or (from_id = other and to_id = one);
$$;

-- ---------------------------------------------------------------------------------------------
-- Friendships

-- As in friends.sql, and a new code also forgives anyone you unfriended: you choose who gets it.
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
  if reset then delete from public.friend_removals where by_id = uid; end if;
  return c;
end;
$$;

-- As in friends.sql, but a block or an unfriend makes the code look wrong, and pending requests are cleared.
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
  if owner = uid then raise exception 'That’s your own code.'; end if;
  if owner is null
    or public.blocked_between(uid, owner)
    or exists (select 1 from public.friend_removals where by_id = owner and who_id = uid) then
    insert into public.invite_attempts (user_id) values (uid);
    return null;
  end if;
  perform public.befriend(uid, owner);
  return owner;
end;
$$;

-- Unfriend, both ways, and remember it, so your old code won't bring them back.
create or replace function public.remove_friend(friend uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if exists (select 1 from public.friendships where user_id = uid and friend_id = friend) then
    insert into public.friend_removals (by_id, who_id) values (uid, friend) on conflict do nothing;
  end if;
  delete from public.friendships where (user_id = uid and friend_id = friend) or (user_id = friend and friend_id = uid);
end;
$$;

-- Your friends, now saying whether each shares their diary (0 entries can also just mean a new diary).
drop function if exists public.my_friends();
create function public.my_friends()
returns table (user_id uuid, name text, bio text, photo_path text, favourites jsonb, since timestamptz, entries bigint, shares_diary boolean)
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
           else 0 end,
         public.shares(f.friend_id, 'diary')
  from public.friendships f
  left join public.profiles p on p.user_id = f.friend_id
  where f.user_id = (select auth.uid())
  order by f.created_at desc;
$$;

-- As in friends.sql, with a tie-break, so pages can't repeat or skip entries saved at the same moment.
create or replace function public.friend_diary(friend uuid, max_rows int default 500)
returns setof jsonb
language sql stable security definer set search_path = ''
as $$
  select public.entry_for_friends(friend, e.data)
  from public.entries e
  where public.is_friend(friend) and public.shares(friend, 'diary')
    and e.user_id = friend and not e.removed and e.data ->> 'deletedAt' is null
  order by e.data ->> 'watchedOn' desc, e.modified_at desc, e.id
  limit least(max_rows, 2000);
$$;

-- ---------------------------------------------------------------------------------------------
-- Requests

-- As in people.sql, leaving out anyone blocked either way, with a photo for people who show their profile.
drop function if exists public.search_people(text);
create function public.search_people(q text)
returns table (user_id uuid, name text, bio text, status text, photo_path text, previewable boolean)
language sql stable security definer set search_path = ''
as $$
  select p.user_id,
         coalesce(p.data ->> 'name', ''),
         coalesce(p.data ->> 'bio', ''),
         case
           when exists (select 1 from public.friend_requests r where r.from_id = (select auth.uid()) and r.to_id = p.user_id) then 'sent'
           when exists (select 1 from public.friend_requests r where r.from_id = p.user_id and r.to_id = (select auth.uid())) then 'received'
           else 'none'
         end,
         case when public.can_preview(p.user_id) then p.photo_path end,
         public.can_preview(p.user_id)
  from public.profiles p
  where (select auth.uid()) is not null
    and length(trim(coalesce(q, ''))) >= 3
    and p.user_id <> (select auth.uid())
    and public.findable(p.user_id)
    and coalesce(p.data ->> 'name', '') <> ''
    and (p.data ->> 'name') ilike '%' || replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    and not public.is_friend(p.user_id)
    and not public.blocked_between((select auth.uid()), p.user_id)
  order by p.data ->> 'name'
  limit 20;
$$;

-- Ask to be friends. Returns 'sent', or 'friends' when they had already asked you.
create or replace function public.send_friend_request(target uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if target = uid then raise exception 'That’s you.'; end if;
  if public.blocked_between(uid, target) then raise exception 'They can’t be found by name right now.'; end if;
  if exists (select 1 from public.friendships where user_id = uid and friend_id = target) then return 'friends'; end if;
  -- They asked first: asking back is saying yes.
  if exists (select 1 from public.friend_requests where from_id = target and to_id = uid) then
    perform public.befriend(uid, target);
    return 'friends';
  end if;
  if not public.findable(target) then raise exception 'They can’t be found by name right now.'; end if;
  if exists (select 1 from public.friend_requests where from_id = uid and to_id = target) then return 'sent'; end if;
  if exists (select 1 from public.friend_declines where from_id = uid and to_id = target and created_at > now() - interval '30 days') then
    raise exception 'They can’t be found by name right now.';
  end if;
  if (select count(*) from public.friend_request_log where from_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many requests today. Try again tomorrow.';
  end if;
  insert into public.friend_request_log (from_id) values (uid);
  insert into public.friend_requests (from_id, to_id) values (uid, target) on conflict do nothing;
  return 'sent';
end;
$$;

-- Requests waiting for you, now with the photo of whoever asked.
drop function if exists public.my_friend_requests();
create function public.my_friend_requests()
returns table (user_id uuid, name text, bio text, sent_at timestamptz, photo_path text)
language sql stable security definer set search_path = ''
as $$
  select r.from_id, coalesce(p.data ->> 'name', ''), coalesce(p.data ->> 'bio', ''), r.created_at, p.photo_path
  from public.friend_requests r
  left join public.profiles p on p.user_id = r.from_id
  where r.to_id = (select auth.uid())
    and not public.blocked_between((select auth.uid()), r.from_id)
  order by r.created_at desc;
$$;

-- Say yes (become friends both ways) or no (they can't ask again for 30 days).
create or replace function public.answer_friend_request(requester uuid, accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  asked boolean;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  asked := exists (select 1 from public.friend_requests where from_id = requester and to_id = uid);
  if accept and asked then
    perform public.befriend(uid, requester);
    return;
  end if;
  if asked then
    insert into public.friend_declines (from_id, to_id) values (requester, uid)
      on conflict (from_id, to_id) do update set created_at = now();
  end if;
  delete from public.friend_requests where (from_id = requester and to_id = uid) or (from_id = uid and to_id = requester);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Blocking

create or replace function public.block_person(target uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if target = uid then raise exception 'That’s you.'; end if;
  insert into public.friend_blocks (blocker_id, blocked_id) values (uid, target) on conflict do nothing;
  delete from public.friendships where (user_id = uid and friend_id = target) or (user_id = target and friend_id = uid);
  delete from public.friend_requests where (from_id = uid and to_id = target) or (from_id = target and to_id = uid);
end;
$$;

create or replace function public.unblock_person(target uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.friend_blocks where blocker_id = (select auth.uid()) and blocked_id = target;
$$;

-- The people you've blocked. Nobody can see who blocked them.
create or replace function public.my_blocks()
returns table (user_id uuid, name text, since timestamptz)
language sql stable security definer set search_path = ''
as $$
  select b.blocked_id, coalesce(p.data ->> 'name', ''), b.created_at
  from public.friend_blocks b
  left join public.profiles p on p.user_id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  order by b.created_at desc;
$$;

-- ---------------------------------------------------------------------------------------------
-- A look at someone: never their diary, reviews or lists. Empty when you may not see them.

create or replace function public.person_preview(target uuid)
returns table (user_id uuid, name text, bio text, photo_path text, favourites jsonb, titles bigint, status text)
language sql stable security definer set search_path = ''
as $$
  select p.user_id,
         coalesce(p.data ->> 'name', ''),
         coalesce(p.data ->> 'bio', ''),
         p.photo_path,
         coalesce(p.data -> 'favourites', '[]'::jsonb),
         case when public.shares(target, 'diary') then (
           select count(distinct coalesce(nullif(e.data ->> 'sourceId', ''), e.data ->> 'title'))
           from public.entries e
           where e.user_id = target and not e.removed and e.data ->> 'deletedAt' is null
         ) else 0 end,
         case
           when public.is_friend(target) then 'friends'
           when exists (select 1 from public.friend_requests r where r.from_id = (select auth.uid()) and r.to_id = target) then 'sent'
           when exists (select 1 from public.friend_requests r where r.from_id = target and r.to_id = (select auth.uid())) then 'received'
           else 'none'
         end
  from public.profiles p
  where p.user_id = target and public.can_preview(target);
$$;

-- ---------------------------------------------------------------------------------------------
-- Who may call what

do $$
declare fn text;
begin
  foreach fn in array array[
    'my_invite_code(boolean)', 'redeem_invite(text)', 'remove_friend(uuid)', 'my_friends()', 'friend_diary(uuid, int)',
    'search_people(text)', 'send_friend_request(uuid)', 'my_friend_requests()', 'answer_friend_request(uuid, boolean)',
    'block_person(uuid)', 'unblock_person(uuid)', 'my_blocks()', 'person_preview(uuid)',
    -- The storage rule below runs as the signed-in person, so these two must be callable.
    'can_preview(uuid)', 'blocked_between(uuid, uuid)', 'previewable(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
  -- Only other functions use this one.
  execute 'revoke all on function public.befriend(uuid, uuid) from public, anon, authenticated';
end;
$$;

-- Photos follow the same rule as previews.
drop policy if exists "people read shared avatars" on storage.objects;
create policy "people read shared avatars" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.can_preview(((storage.foldername(name))[1])::uuid));
