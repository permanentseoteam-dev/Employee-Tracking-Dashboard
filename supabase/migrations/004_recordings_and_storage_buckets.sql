-- ==============================================================================
-- MIGRATION 004: STORAGE BUCKETS & LIVE SCREEN RECORDINGS VAULT
-- Sets up Supabase storage buckets for screenshots and recordings,
-- adds public access policies, and ensures table screen_recordings exists.
-- ==============================================================================

-- 1. Ensure storage buckets exist and are marked public
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
    (
        'screenshots',
        'screenshots',
        true,
        52428800, -- 50 MB
        array['image/jpeg', 'image/png', 'image/webp', 'video/webm', 'video/mp4']
    )
on conflict (id) do update set
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/webm', 'video/mp4'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
    (
        'recordings',
        'recordings',
        true,
        104857600, -- 100 MB
        array['video/webm', 'video/mp4', 'image/jpeg', 'image/png']
    )
on conflict (id) do update set
    public = true,
    file_size_limit = 104857600,
    allowed_mime_types = array['video/webm', 'video/mp4', 'image/jpeg', 'image/png'];

-- 2. Storage Policies for 'screenshots' bucket
drop policy if exists "Screenshots Public Access" on storage.objects;
create policy "Screenshots Public Access"
    on storage.objects for select
    using (bucket_id = 'screenshots');

drop policy if exists "Screenshots Upload Access" on storage.objects;
create policy "Screenshots Upload Access"
    on storage.objects for insert
    with check (bucket_id = 'screenshots');

drop policy if exists "Screenshots Update Access" on storage.objects;
create policy "Screenshots Update Access"
    on storage.objects for update
    using (bucket_id = 'screenshots');

-- 3. Storage Policies for 'recordings' bucket
drop policy if exists "Recordings Public Access" on storage.objects;
create policy "Recordings Public Access"
    on storage.objects for select
    using (bucket_id = 'recordings');

drop policy if exists "Recordings Upload Access" on storage.objects;
create policy "Recordings Upload Access"
    on storage.objects for insert
    with check (bucket_id = 'recordings');

drop policy if exists "Recordings Update Access" on storage.objects;
create policy "Recordings Update Access"
    on storage.objects for update
    using (bucket_id = 'recordings');

-- 4. Screen Recordings Table
create table if not exists public.screen_recordings (
    id text primary key,
    employee_id uuid not null references public.profiles(id) on delete cascade,
    device_id text not null default 'WIN-CLIENT',
    started_at timestamptz not null default now(),
    duration_seconds integer not null default 10,
    storage_path text not null,
    video_url text not null,
    thumbnail_url text,
    recorded_by text not null default 'Admin',
    active_window text default 'Visual Studio Code',
    file_size_bytes bigint default 0,
    status text not null default 'completed' check (status in ('recording', 'processing', 'completed', 'failed')),
    trigger_type text not null default 'on_demand' check (trigger_type in ('on_demand', 'scheduled', 'rule_triggered')),
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_screen_recordings_emp on public.screen_recordings(employee_id, started_at desc);
create index if not exists idx_screen_recordings_status on public.screen_recordings(status);

-- 5. Enable Row Level Security and configure access
alter table public.screen_recordings enable row level security;

drop policy if exists "Allow select screen recordings" on public.screen_recordings;
create policy "Allow select screen recordings"
    on public.screen_recordings for select
    using (true);

drop policy if exists "Allow insert screen recordings" on public.screen_recordings;
create policy "Allow insert screen recordings"
    on public.screen_recordings for insert
    with check (true);

drop policy if exists "Allow update screen recordings" on public.screen_recordings;
create policy "Allow update screen recordings"
    on public.screen_recordings for update
    using (true);
