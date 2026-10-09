-- Avatars storage bucket + profile fields for all roles

-- 1. Profile columns used by Edit Profile (all roles)
alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists team_name text;

alter table public.profiles
  add column if not exists phone text;

alter table public.profiles
  add column if not exists updated_at timestamptz default now();

-- Mirror on users when present
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    alter table public.users add column if not exists department text;
    alter table public.users add column if not exists avatar_url text;
    alter table public.users add column if not exists team_name text;
    alter table public.users add column if not exists phone text;
  end if;
end $$;

-- Mirror on employees when present
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'employees'
  ) then
    alter table public.employees add column if not exists avatar_url text;
    alter table public.employees add column if not exists phone text;
    alter table public.employees add column if not exists team_name text;
  end if;
end $$;

-- 2. Avatars bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "Avatars Public Read" on storage.objects;
create policy "Avatars Public Read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Avatars Upload" on storage.objects;
create policy "Avatars Upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars');

drop policy if exists "Avatars Update" on storage.objects;
create policy "Avatars Update"
  on storage.objects for update
  using (bucket_id = 'avatars');

drop policy if exists "Avatars Delete" on storage.objects;
create policy "Avatars Delete"
  on storage.objects for delete
  using (bucket_id = 'avatars');
