-- Watch Heart: a review's heading (1.8.15). Run after friends.sql (or schema.sql); safe to run again.
--
-- An entry can have a heading (entries.data.heading): one short line above the review, which the share card shows
-- whole when a long review would be cut off. It is part of the review, so friends see it only when reviews are
-- shared, the same as the review itself. Entries sync as one JSON record, so there's no new column.

create or replace function public.entry_for_friends(owner uuid, entry jsonb)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case
    when public.shares(owner, 'reviews') then entry - 'companions' - 'tags'
    else (entry - 'companions' - 'tags' - 'review' - 'heading') || '{"review": "", "spoilers": false}'::jsonb
  end;
$$;

revoke all on function public.entry_for_friends(uuid, jsonb) from public, anon;
grant execute on function public.entry_for_friends(uuid, jsonb) to authenticated;
