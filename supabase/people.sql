-- Watch Heart: find friends by name, with friend requests.
-- Paste into Supabase Dashboard -> SQL Editor -> New query, then Run. Safe to run more than once.
-- Needs friends.sql (and profile.sql) first.
--
-- How it's private:
--   * Nobody can be found unless they turn on "Let people find me by name" in Settings
--     (profiles.data.sharing.findable). Off by default.
--   * A search needs three or more letters and shows at most 20 people: name and bio only, no photo,
--     diary or lists. Your friends and you never appear.
--   * Finding someone sends a request; nothing is shared until they accept. If they had already asked
--     you, asking back makes you friends at once. 30 requests a day at most.
--   * Only the functions below touch the requests table.

create table if not exists public.friend_requests (
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists friend_requests_to on public.friend_requests (to_id);
alter table public.friend_requests enable row level security;

-- Whether someone lets themselves be found by name (off unless they turned it on).
create or replace function public.findable(owner uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select (p.data -> 'sharing' ->> 'findable')::boolean from public.profiles p where p.user_id = owner), false);
$$;

-- People you could add, by name: findable, not you, not already friends.
create or replace function public.search_people(q text)
returns table (user_id uuid, name text, bio text, status text)
language sql stable security definer set search_path = ''
as $$
  select p.user_id,
         coalesce(p.data ->> 'name', ''),
         coalesce(p.data ->> 'bio', ''),
         case
           when exists (select 1 from public.friend_requests r where r.from_id = (select auth.uid()) and r.to_id = p.user_id) then 'sent'
           when exists (select 1 from public.friend_requests r where r.from_id = p.user_id and r.to_id = (select auth.uid())) then 'received'
           else 'none'
         end
  from public.profiles p
  where (select auth.uid()) is not null
    and length(trim(coalesce(q, ''))) >= 3
    and p.user_id <> (select auth.uid())
    and public.findable(p.user_id)
    and coalesce(p.data ->> 'name', '') <> ''
    and (p.data ->> 'name') ilike '%' || replace(replace(replace(trim(q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    and not public.is_friend(p.user_id)
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
  if exists (select 1 from public.friendships where user_id = uid and friend_id = target) then return 'friends'; end if;
  -- They asked first: asking back is saying yes.
  if exists (select 1 from public.friend_requests where from_id = target and to_id = uid) then
    insert into public.friendships (user_id, friend_id) values (uid, target), (target, uid) on conflict do nothing;
    delete from public.friend_requests where (from_id = target and to_id = uid) or (from_id = uid and to_id = target);
    return 'friends';
  end if;
  if not public.findable(target) then raise exception 'They can’t be found by name right now.'; end if;
  if (select count(*) from public.friend_requests where from_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many requests today. Try again tomorrow.';
  end if;
  insert into public.friend_requests (from_id, to_id) values (uid, target) on conflict do nothing;
  return 'sent';
end;
$$;

-- Requests waiting for you: who asked (name and bio) and when.
create or replace function public.my_friend_requests()
returns table (user_id uuid, name text, bio text, sent_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.from_id, coalesce(p.data ->> 'name', ''), coalesce(p.data ->> 'bio', ''), r.created_at
  from public.friend_requests r
  left join public.profiles p on p.user_id = r.from_id
  where r.to_id = (select auth.uid())
  order by r.created_at desc;
$$;

-- Say yes (become friends both ways) or no (the request goes).
create or replace function public.answer_friend_request(requester uuid, accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if accept and exists (select 1 from public.friend_requests where from_id = requester and to_id = uid) then
    insert into public.friendships (user_id, friend_id) values (uid, requester), (requester, uid) on conflict do nothing;
  end if;
  delete from public.friend_requests where (from_id = requester and to_id = uid) or (from_id = uid and to_id = requester);
end;
$$;

-- Take back a request you sent.
create or replace function public.cancel_friend_request(target uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.friend_requests where from_id = (select auth.uid()) and to_id = target;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'findable(uuid)', 'search_people(text)', 'send_friend_request(uuid)', 'my_friend_requests()',
    'answer_friend_request(uuid, boolean)', 'cancel_friend_request(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
