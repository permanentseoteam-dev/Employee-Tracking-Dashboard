-- ==============================================================================
-- MIGRATION 002: PRESENCE AND ACTIVITY EVENTS
-- Adds real-time presence tracking and lightweight activity events
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. EMPLOYEE PRESENCE TABLE
create table if not exists public.employee_presence (
    employee_id uuid not null references public.profiles(id) on delete cascade,
    device_id text not null,
    status text not null check (status in ('active', 'idle', 'offline')),
    last_activity_at timestamptz not null default now(),
    idle_since timestamptz,
    updated_at timestamptz not null default now(),
    primary key (employee_id, device_id)
);

create index if not exists idx_presence_status on public.employee_presence(status);
create index if not exists idx_presence_updated on public.employee_presence(updated_at desc);

-- 2. ACTIVITY EVENTS TABLE (Lightweight event stream)
create table if not exists public.activity_events (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.profiles(id) on delete cascade,
    device_id text not null,
    event_type text not null, -- 'status_change', 'heartbeat', 'idle_start', 'active_resume'
    occurred_at timestamptz not null default now(),
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_activity_events_emp_time on public.activity_events(employee_id, occurred_at desc);
create index if not exists idx_activity_events_type on public.activity_events(event_type);

-- 3. ENABLE ROW LEVEL SECURITY
alter table public.employee_presence enable row level security;
alter table public.activity_events enable row level security;

-- 4. RLS POLICIES FOR EMPLOYEE PRESENCE
-- Employees can upsert their own presence record
create policy "Employees can insert or update own presence"
    on public.employee_presence for all
    using (auth.uid() = employee_id or auth.role() = 'anon')
    with check (auth.uid() = employee_id or auth.role() = 'anon');

-- Managers & Admins can read presence
create policy "Managers and Admins can view employee presence"
    on public.employee_presence for select
    using (auth.uid() = employee_id or public.is_manager() or auth.role() = 'anon');

-- 5. RLS POLICIES FOR ACTIVITY EVENTS
-- Employees can insert their own events
create policy "Employees can insert own activity events"
    on public.activity_events for insert
    with check (auth.uid() = employee_id or auth.role() = 'anon');

-- Managers & Admins can read activity events
create policy "Managers and Admins can view activity events"
    on public.activity_events for select
    using (auth.uid() = employee_id or public.is_manager() or auth.role() = 'anon');
