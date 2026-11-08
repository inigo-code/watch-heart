-- Watch Heart: people you might know, and people who watch what you watch.
-- Paste into Supabase Dashboard -> SQL Editor -> New query, then Run. Safe to run more than once.
-- Needs friends.sql, profile.sql, people.sql and friends-safety.sql first. The app hides the
-- suggestions until this has been run.
--
-- Who can be suggested, and to whom:
--   * Only people who turned on "Let people find me by name" (profiles.data.sharing.findable).
--   * Friends of your friends, with how many friends you share. Your friend could already see both of you.
--   * People with the same titles in their diary, with how many titles you share, never which ones. Only
--     between two people who both turned on "Suggest me to people who watch the same things"
--     (profiles.data.sharing.taste, off by default).
--   * Never: you, your friends, anyone blocked either way, anyone either of you unfriended, or anyone who
--     declined your request in the last 30 days.

-- Finds diary entries by title quickly.
create index if not exists entries_title_idx on public.entries ((data ->> 'source'), (data ->> 'sourceId'))
  where not removed and data ->> 'source' <> 'manual';

create or replace function public.taste_sharing(owner uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select (p.data -> 'sharing' ->> 'taste')::boolean from public.profiles p where p.user_id = owner), false);
$$;

create or replace function public.suggest_people()
returns table (user_id uuid, name text, bio text, status text, photo_path text, previewable boolean, mutual int, common int)
language sql stable security definer set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  mutuals as (
    select f2.friend_id as who, count(*)::int as n
    from public.friendships f1
    join public.friendships f2 on f2.user_id = f1.friend_id
    where f1.user_id = (select id from me) and f2.friend_id <> (select id from me)
    group by f2.friend_id
  ),
  my_titles as (
    select distinct e.data ->> 'source' as source, e.data ->> 'sourceId' as source_id
    from public.entries e
    where e.user_id = (select id from me) and not e.removed and e.data ->> 'deletedAt' is null
      and e.data ->> 'source' <> 'manual' and coalesce(e.data ->> 'sourceId', '') <> ''
      and public.taste_sharing((select id from me))
  ),
  tastes as (
    select e.user_id as who, count(distinct (e.data ->> 'source', e.data ->> 'sourceId'))::int as n
    from public.entries e
    join my_titles t on e.data ->> 'source' = t.source and e.data ->> 'sourceId' = t.source_id
    where not e.removed and e.data ->> 'source' <> 'manual' and e.data ->> 'deletedAt' is null
      and e.user_id <> (select id from me)
    group by e.user_id
    having count(distinct (e.data ->> 'source', e.data ->> 'sourceId')) >= 5
  ),
  candidates as (
    select coalesce(m.who, t.who) as who, coalesce(m.n, 0) as mutual,
           case when public.taste_sharing(coalesce(m.who, t.who)) then coalesce(t.n, 0) else 0 end as common
    from mutuals m
    full join tastes t on t.who = m.who
  )
  select p.user_id,
         coalesce(p.data ->> 'name', ''),
         coalesce(p.data ->> 'bio', ''),
         case
           when exists (select 1 from public.friend_requests r where r.from_id = (select id from me) and r.to_id = p.user_id) then 'sent'
           when exists (select 1 from public.friend_requests r where r.from_id = p.user_id and r.to_id = (select id from me)) then 'received'
           else 'none'
         end,
         case when public.can_preview(p.user_id) then p.photo_path end,
         public.can_preview(p.user_id),
         c.mutual,
         c.common
  from candidates c
  join public.profiles p on p.user_id = c.who
  where (select id from me) is not null
    and (c.mutual > 0 or c.common > 0)
    and public.findable(p.user_id)
    and coalesce(p.data ->> 'name', '') <> ''
    and not public.is_friend(p.user_id)
    and not public.blocked_between((select id from me), p.user_id)
    and not exists (
      select 1 from public.friend_removals r
      where (r.by_id = (select id from me) and r.who_id = p.user_id) or (r.by_id = p.user_id and r.who_id = (select id from me))
    )
    and not exists (
      select 1 from public.friend_declines d
      where d.from_id = (select id from me) and d.to_id = p.user_id and d.created_at > now() - interval '30 days'
    )
  order by c.mutual desc, c.common desc, p.data ->> 'name'
  limit 12;
$$;

revoke all on function public.taste_sharing(uuid) from public, anon, authenticated;
revoke all on function public.suggest_people() from public, anon;
grant execute on function public.suggest_people() to authenticated;
