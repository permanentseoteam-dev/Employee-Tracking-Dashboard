-- ==============================================================================
-- MIGRATION 003: SCREEN RECORDINGS TABLE
-- Stores on-demand and scheduled employee screen recording sessions
-- Run in Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

create table if not exists public.screen_recordings (
    id text primary key,
    employee_id uuid not null references public.profiles(id) on delete cascade,
    device_id text not null,
    started_at timestamptz not null default now(),
    duration_seconds integer not null default 10,
    storage_path text,
    video_url text,
    thumbnail_url text,
    recorded_by text not null,
    active_window text,
    file_size_bytes bigint default 0,
    status text not null default 'completed' check (status in ('recording', 'processing', 'completed', 'failed')),
    trigger_type text not null default 'on_demand' check (trigger_type in ('on_demand', 'scheduled', 'rule_triggered')),
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_screen_recordings_emp on public.screen_recordings(employee_id, started_at desc);
create index if not exists idx_screen_recordings_status on public.screen_recordings(status);

-- Enable Row Level Security
alter table public.screen_recordings enable row level security;

-- Policies
create policy "Admins and Managers can view screen recordings"
    on public.screen_recordings for select
    using (auth.uid() = employee_id or public.is_manager() or auth.role() = 'anon');

create policy "Admins and Managers can insert screen recordings"
    on public.screen_recordings for insert
    with check (auth.role() = 'anon' or public.is_manager());
