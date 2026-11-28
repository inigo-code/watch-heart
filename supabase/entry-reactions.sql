-- Watch Heart: emoji reactions on diary entries. Hold the heart on a friend's entry and pick one; a plain like
-- is the heart, so every reaction is a like and the like counts stay as they were.
-- Paste into Supabase Dashboard -> SQL Editor -> New query, then Run. Safe to run more than once.
-- Needs entry-social.sql first (run this again after running that one again: it replaces social_news).
-- Older versions of the app keep working: their likes are hearts, and they count every reaction as a like.
--
-- Who sees what is as for likes: whoever can see the entry sees how many of each emoji and which is theirs;
-- only the owner sees who reacted, with what. Blocked people's reactions are hidden both ways.

alter table public.entry_likes add column if not exists emoji text not null default '❤️';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entry_likes_emoji_check' and conrelid = 'public.entry_likes'::regclass) then
    alter table public.entry_likes add constraint entry_likes_emoji_check check (emoji in ('❤️', '😂', '😮', '😢', '🍿', '🔥'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reading

-- How many of each emoji on a batch of entries, and whether one is yours. owners[i] owns ids[i]. Entries you
-- can't see are left out, and so are entries without any.
create or replace function public.entry_reactions(owners uuid[], ids text[])
returns table (owner_id uuid, entry_id text, emoji text, count int, mine boolean)
language sql stable security definer set search_path = ''
as $$
  select l.owner_id, l.entry_id, l.emoji, count(*)::int, bool_or(l.user_id = (select auth.uid()))
  from (select distinct u.owner, u.id from unnest(owners[1:200], ids[1:200]) as u(owner, id)) x
  join public.entry_likes l on l.owner_id = x.owner and l.entry_id = x.id
  where x.owner is not null and x.id is not null and public.can_see_entry(x.owner, x.id)
    and not public.blocked_between((select auth.uid()), l.user_id)
  group by l.owner_id, l.entry_id, l.emoji;
$$;

-- Who reacted to your entry and with what, newest first. Only the owner gets anything.
create or replace function public.entry_reactors(owner uuid, entry text)
returns table (user_id uuid, name text, photo_path text, emoji text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select l.user_id, public.display_name(l.user_id), public.photo_for(l.user_id), l.emoji, l.created_at
  from public.entry_likes l
  where owner = (select auth.uid()) and public.can_see_entry(owner, entry)
    and l.owner_id = owner and l.entry_id = entry
    and not public.blocked_between((select auth.uid()), l.user_id)
  order by l.created_at desc;
$$;

-- As in entry-social.sql, except that a like with an emoji other than the heart carries it in `body`
-- ("Asha reacted 😂 to your entry"). Older apps don't read `body` for likes.
create or replace function public.social_news(since timestamptz default null)
returns table (kind text, id text, owner_id uuid, entry_id text, who_id uuid, who text, title text, body text, at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid, greatest(coalesce(since, now() - interval '30 days'), now() - interval '30 days') as since),
  news as (
    select 'like'::text as kind, 'like-' || l.entry_id || '-' || l.user_id::text as id, l.owner_id, l.entry_id,
           l.user_id as who_id, nullif(l.emoji, '❤️') as body, l.created_at as at
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

-- React to an entry, change your reaction, or take it off (no emoji, or the one already there). Returns your
-- reaction now, or null. Your own entry does nothing. A changed reaction keeps its time, so it isn't announced
-- again. At most 300 new ones an hour.
create or replace function public.react_entry(owner uuid, entry text, emoji text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  had text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if owner = uid then return null; end if;
  if not public.can_see_entry(owner, entry) then raise exception 'That entry isn’t shared with you'; end if;
  select l.emoji into had from public.entry_likes l where l.owner_id = owner and l.entry_id = entry and l.user_id = uid;
  if nullif(trim(coalesce(emoji, '')), '') is null or emoji = had then
    delete from public.entry_likes l where l.owner_id = owner and l.entry_id = entry and l.user_id = uid;
    return null;
  end if;
  if emoji not in ('❤️', '😂', '😮', '😢', '🍿', '🔥') then raise exception 'Pick one of the reactions shown'; end if;
  if had is null and (select count(*) from public.entry_likes l where l.user_id = uid and l.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Too many reactions. Try again in a while.';
  end if;
  insert into public.entry_likes (owner_id, entry_id, user_id, emoji) values (owner, entry, uid, emoji)
  on conflict (owner_id, entry_id, user_id) do update set emoji = excluded.emoji;
  return emoji;
end;
$$;

-- Only signed-in accounts can call these.
do $$
declare fn text;
begin
  foreach fn in array array['entry_reactions(uuid[], text[])', 'entry_reactors(uuid, text)', 'social_news(timestamptz)', 'react_entry(uuid, text, text)'] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
