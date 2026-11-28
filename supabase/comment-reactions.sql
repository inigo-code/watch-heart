-- Watch Heart: emoji reactions on comments and replies.
-- Paste into Supabase Dashboard -> SQL Editor -> New query, then Run. Safe to run more than once.
-- Needs entry-social.sql first. The app keeps working without it (reactions just don't show), and older
-- versions of the app keep working with it.
--
-- Who sees what (the same as likes and comments on the entry):
--   * Whoever can see the entry can react to any comment on it that isn't their own: one reaction each,
--     from ❤️ 😂 😮 😢 🍿 🔥. The same one again takes it off.
--   * Everyone who can see the entry sees how many of each, and which one is theirs. No names.
--   * Blocking someone hides their reactions from you, and yours from them; you can't react to their comments.
--   * A deleted comment takes its reactions with it.
--   * No one reads the table directly. Only the functions below do, and they check all of the above.

create table if not exists public.comment_reactions (
  comment_id uuid not null references public.entry_comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '😂', '😮', '😢', '🍿', '🔥')),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists comment_reactions_user on public.comment_reactions (user_id, created_at);
alter table public.comment_reactions enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Reading

-- The reactions on an entry's comments: each comment's emoji, how many, and whether one is yours.
create or replace function public.comment_reaction_counts(owner uuid, entry text)
returns table (comment_id uuid, emoji text, count int, mine boolean)
language sql stable security definer set search_path = ''
as $$
  select r.comment_id, r.emoji, count(*)::int, bool_or(r.user_id = (select auth.uid()))
  from public.comment_reactions r
  join public.entry_comments c on c.id = r.comment_id
  where public.can_see_entry(owner, entry)
    and c.owner_id = owner and c.entry_id = entry
    and not public.blocked_between((select auth.uid()), c.author_id)
    and not public.blocked_between((select auth.uid()), r.user_id)
  group by r.comment_id, r.emoji;
$$;

-- ---------------------------------------------------------------------------------------------
-- Writing

-- React to a comment, change your reaction, or take it off (no emoji, or the one already there).
-- Returns your reaction now, or null. Reacting to your own comment does nothing. At most 300 an hour.
create or replace function public.react_comment(comment uuid, emoji text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c public.entry_comments;
  had text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into c from public.entry_comments where id = comment;
  if not found or not public.can_see_entry(c.owner_id, c.entry_id) or public.blocked_between(uid, c.author_id) then
    raise exception 'That comment isn’t shared with you';
  end if;
  if c.author_id = uid then return null; end if;
  select r.emoji into had from public.comment_reactions r where r.comment_id = comment and r.user_id = uid;
  if nullif(trim(coalesce(emoji, '')), '') is null or emoji = had then
    delete from public.comment_reactions r where r.comment_id = comment and r.user_id = uid;
    return null;
  end if;
  if emoji not in ('❤️', '😂', '😮', '😢', '🍿', '🔥') then raise exception 'Pick one of the reactions shown'; end if;
  if (select count(*) from public.comment_reactions r where r.user_id = uid and r.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Too many reactions. Try again in a while.';
  end if;
  insert into public.comment_reactions (comment_id, user_id, emoji) values (comment, uid, emoji)
  on conflict (comment_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  return emoji;
end;
$$;

-- Only signed-in accounts can call these.
do $$
declare fn text;
begin
  foreach fn in array array['comment_reaction_counts(uuid, text)', 'react_comment(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
