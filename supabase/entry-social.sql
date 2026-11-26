-- Watch Heart: likes and comments on diary entries.
-- Paste into Supabase Dashboard -> SQL Editor -> New query, then Run. Safe to run more than once.
-- Needs friends.sql, people.sql and friends-safety.sql first. The app keeps working without it (likes and
-- comments just don't show), and older versions of the app keep working with it.
--
-- Who sees what:
--   * Whoever can see an entry can like it and comment on it: its owner, and the owner's friends while the
--     owner shares their diary. A comment from the owner is their reply.
--   * One conversation per entry. Everyone who can see the entry reads all of it, with each person's name.
--     Photos come only for people you're friends with (the avatars bucket keeps its rules).
--   * Likes: the owner sees who liked; friends see how many, and whether they liked it themselves.
--   * Blocking someone hides their comments and likes from you, and yours from them.
--   * The owner can delete any comment on their entry; everyone can delete their own.
--   * No one reads these tables directly. Only the functions below do, and they check all of the above.

create table if not exists public.entry_likes (
  owner_id uuid not null references auth.users (id) on delete cascade,
  entry_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, entry_id, user_id)
);
create index if not exists entry_likes_owner_time on public.entry_likes (owner_id, created_at);
alter table public.entry_likes enable row level security;

create table if not exists public.entry_comments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  entry_id text not null,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists entry_comments_entry on public.entry_comments (owner_id, entry_id, created_at);
create index if not exists entry_comments_author on public.entry_comments (author_id, created_at);
create index if not exists entry_comments_owner_time on public.entry_comments (owner_id, created_at);
alter table public.entry_comments enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Helpers

-- Whether you can see this entry: it's yours, or a friend's while they share their diary. Deleted entries
-- (and their conversations) are seen by no one.
create or replace function public.can_see_entry(owner uuid, entry text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      owner = (select auth.uid())
      or (public.is_friend(owner) and public.shares(owner, 'diary') and not public.blocked_between((select auth.uid()), owner))
    )
    and exists (
      select 1 from public.entries e
      where e.user_id = owner and e.id = entry and not e.removed and e.data ->> 'deletedAt' is null
    );
$$;

-- A name to show: what they called themselves on their profile.
create or replace function public.display_name(who uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(nullif(trim((select p.data ->> 'name' from public.profiles p where p.user_id = who)), ''), 'Someone');
$$;

-- Their photo's path, only when you may see it (yourself or a friend), else null.
create or replace function public.photo_for(who uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case when who = (select auth.uid()) or public.is_friend(who)
    then (select p.photo_path from public.profiles p where p.user_id = who) end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reading

-- Likes and comments for a batch of entries (a feed, a diary page): how many likes, whether you liked it,
-- and how many comments. owners[i] owns ids[i]. Entries you can't see are left out.
create or replace function public.entry_social(owners uuid[], ids text[])
returns table (owner_id uuid, entry_id text, likes int, liked boolean, comments int)
language sql stable security definer set search_path = ''
as $$
  select x.owner, x.id,
    (select count(*)::int from public.entry_likes l
      where l.owner_id = x.owner and l.entry_id = x.id and not public.blocked_between((select auth.uid()), l.user_id)),
    exists (select 1 from public.entry_likes l where l.owner_id = x.owner and l.entry_id = x.id and l.user_id = (select auth.uid())),
    (select count(*)::int from public.entry_comments c
      where c.owner_id = x.owner and c.entry_id = x.id and not public.blocked_between((select auth.uid()), c.author_id))
  from (select distinct u.owner, u.id from unnest(owners[1:200], ids[1:200]) as u(owner, id)) x
  where x.owner is not null and x.id is not null and public.can_see_entry(x.owner, x.id);
$$;

-- The conversation on an entry, oldest first.
create or replace function public.entry_thread(owner uuid, entry text)
returns table (id uuid, author_id uuid, name text, photo_path text, body text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.author_id, public.display_name(c.author_id), public.photo_for(c.author_id), c.body, c.created_at
  from public.entry_comments c
  where public.can_see_entry(owner, entry)
    and c.owner_id = owner and c.entry_id = entry
    and not public.blocked_between((select auth.uid()), c.author_id)
  order by c.created_at
  limit 500;
$$;

-- Who liked your entry, newest first. Only the owner gets names; anyone else gets nothing.
create or replace function public.entry_likers(owner uuid, entry text)
returns table (user_id uuid, name text, photo_path text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select l.user_id, public.display_name(l.user_id), public.photo_for(l.user_id), l.created_at
  from public.entry_likes l
  where owner = (select auth.uid()) and public.can_see_entry(owner, entry)
    and l.owner_id = owner and l.entry_id = entry
    and not public.blocked_between((select auth.uid()), l.user_id)
  order by l.created_at desc;
$$;

-- A friend's entry as they share it, for opening it from a notification.
create or replace function public.friend_entry(owner uuid, entry text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select public.entry_for_friends(e.user_id, e.data)
  from public.entries e
  where owner <> (select auth.uid()) and public.can_see_entry(owner, entry)
    and e.user_id = owner and e.id = entry;
$$;

-- What's happened since then, for the phone's alerts and the Friends page: likes and comments on your
-- entries, and comments after yours on other people's. Thirty days at most.
create or replace function public.social_news(since timestamptz default null)
returns table (kind text, id text, owner_id uuid, entry_id text, who_id uuid, who text, title text, body text, at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid, greatest(coalesce(since, now() - interval '30 days'), now() - interval '30 days') as since),
  news as (
    select 'like'::text as kind, 'like-' || l.entry_id || '-' || l.user_id::text as id, l.owner_id, l.entry_id,
           l.user_id as who_id, null::text as body, l.created_at as at
    from public.entry_likes l, me
    where l.owner_id = me.uid and l.user_id <> me.uid and l.created_at > me.since
    union all
    select 'comment', 'comment-' || c.id::text, c.owner_id, c.entry_id, c.author_id, c.body, c.created_at
    from public.entry_comments c, me
    where c.owner_id = me.uid and c.author_id <> me.uid and c.created_at > me.since
    union all
    select case when c.author_id = c.owner_id then 'reply' else 'also' end, 'comment-' || c.id::text, c.owner_id, c.entry_id,
           c.author_id, c.body, c.created_at
    from public.entry_comments c, me
    where c.owner_id <> me.uid and c.author_id <> me.uid and c.created_at > me.since
      and exists (
        select 1 from public.entry_comments mine
        where mine.owner_id = c.owner_id and mine.entry_id = c.entry_id and mine.author_id = me.uid and mine.created_at < c.created_at
      )
  )
  select n.kind, n.id, n.owner_id, n.entry_id, n.who_id, public.display_name(n.who_id),
         coalesce((select e.data ->> 'title' from public.entries e where e.user_id = n.owner_id and e.id = n.entry_id), ''),
         n.body, n.at
  from news n
  where not public.blocked_between((select auth.uid()), n.who_id) and public.can_see_entry(n.owner_id, n.entry_id)
  order by n.at desc
  limit 50;
$$;

-- ---------------------------------------------------------------------------------------------
-- Writing

-- Like or unlike an entry. Liking your own does nothing.
create or replace function public.like_entry(owner uuid, entry text, on_off boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if owner = uid then return; end if;
  if on_off then
    if not public.can_see_entry(owner, entry) then raise exception 'That entry isn’t shared with you'; end if;
    insert into public.entry_likes (owner_id, entry_id, user_id) values (owner, entry, uid) on conflict do nothing;
  else
    delete from public.entry_likes where owner_id = owner and entry_id = entry and user_id = uid;
  end if;
end;
$$;

-- Add a comment (the owner's is a reply). Returns its id. At most 60 an hour.
create or replace function public.add_comment(owner uuid, entry text, words text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean text := trim(coalesce(words, ''));
  new_id uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if clean = '' then raise exception 'Write something first'; end if;
  if char_length(clean) > 1000 then raise exception 'That’s too long. Keep it under 1000 characters.'; end if;
  if not public.can_see_entry(owner, entry) then raise exception 'That entry isn’t shared with you'; end if;
  if (select count(*) from public.entry_comments where author_id = uid and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many comments. Try again in a while.';
  end if;
  insert into public.entry_comments (owner_id, entry_id, author_id, body) values (owner, entry, uid, clean) returning id into new_id;
  return new_id;
end;
$$;

-- Delete a comment: your own, or any on your entry.
create or replace function public.delete_comment(comment uuid)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.entry_comments
  where id = comment and (author_id = (select auth.uid()) or owner_id = (select auth.uid()));
$$;

-- Only signed-in accounts can call these.
do $$
declare fn text;
begin
  foreach fn in array array[
    'can_see_entry(uuid, text)', 'display_name(uuid)', 'photo_for(uuid)', 'entry_social(uuid[], text[])',
    'entry_thread(uuid, text)', 'entry_likers(uuid, text)', 'friend_entry(uuid, text)', 'social_news(timestamptz)',
    'like_entry(uuid, text, boolean)', 'add_comment(uuid, text, text)', 'delete_comment(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
