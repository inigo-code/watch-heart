-- Watch Heart: the profile (name, bio, favourite four, yearly goal) and its photo, synced across devices.
-- Paste into Supabase Dashboard -> SQL Editor -> New query, then Run. Safe to run more than once.
-- (Also part of schema.sql, for new projects.)

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
