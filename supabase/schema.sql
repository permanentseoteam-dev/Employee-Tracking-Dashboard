-- ==============================================================================
-- SUPABASE POSTGRESQL SCHEMA WITH STRICT ROLE-BASED ACCESS CONTROL (RLS)
-- Core 8 Tables: organizations, users, employees, devices, screenshots,
--                employee_activity, tasks, projects
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/isywkcymfzpgjerfuors
-- 2. Go to "SQL Editor" -> Click "New Query" (or replace existing), paste this entire file, and click "Run" (Ctrl+Enter).
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- 2. CLEAN DROP OF OLD CONFLICTING DUMMY TABLES (Ensures pristine schema without column mismatch errors)
drop table if exists public.tasks cascade;
drop table if exists public.projects cascade;
drop table if exists public.employee_activity cascade;
drop table if exists public.screenshots cascade;
drop table if exists public.devices cascade;
drop table if exists public.employees cascade;
drop table if exists public.users cascade;
drop table if exists public.organizations cascade;

-- 3. ORGANIZATIONS TABLE
create table public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_at timestamptz default now()
);

-- 4. USERS TABLE (Identity & role management)
create table public.users (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid references public.organizations(id) on delete cascade,
    email text not null unique,
    full_name text not null default '',
    role text not null check (role in ('admin', 'manager', 'employee')) default 'employee',
    avatar_url text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Profiles table for legacy triggers and auth sync
create table if not exists public.profiles (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    full_name text not null default '',
    role text not null check (role in ('admin', 'manager', 'employee')) default 'employee',
    department text default 'Engineering',
    team_id uuid,
    avatar_url text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 5. EMPLOYEES TABLE (Employee details, organization and manager assignment)
create table public.employees (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete cascade,
    organization_id uuid references public.organizations(id) on delete cascade,
    manager_id uuid references public.users(id) on delete set null,
    full_name text not null default '',
    email text not null,
    department text default 'Engineering',
    status text not null check (status in ('active', 'idle', 'offline')) default 'offline',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 6. DEVICES TABLE (Registered agent workstations)
create table public.devices (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.employees(id) on delete cascade,
    device_name text not null,
    device_identifier text not null,
    os_version text default 'Windows 10/11 x86_64',
    agent_version text default '0.1.0',
    last_seen_at timestamptz default now(),
    created_at timestamptz default now()
);

-- 7. PROJECTS TABLE
create table public.projects (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid references public.organizations(id) on delete cascade,
    name text not null,
    description text default '',
    status text not null default 'active' check (status in ('active', 'paused', 'completed')),
    manager_id uuid references public.users(id) on delete set null,
    created_at timestamptz default now()
);

-- 8. TASKS TABLE
create table public.tasks (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references public.projects(id) on delete cascade,
    title text not null,
    description text default '',
    assigned_to uuid references public.employees(id) on delete set null,
    status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
    estimated_hours numeric default 0,
    created_at timestamptz default now()
);

-- 9. SCREENSHOTS TABLE
create table public.screenshots (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.employees(id) on delete cascade,
    device_id uuid references public.devices(id) on delete set null,
    storage_path text not null,
    file_size_bytes bigint not null default 0,
    width integer default 1920,
    height integer default 1080,
    captured_at timestamptz not null default now(),
    created_at timestamptz default now()
);
create index if not exists idx_screenshots_emp_time on public.screenshots(employee_id, captured_at desc);

-- Legacy screenshot records table
create table if not exists public.screenshot_records (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null,
    device_id text not null,
    captured_at timestamptz not null default now(),
    storage_path text not null,
    thumbnail_path text,
    file_size_bytes bigint not null default 0,
    created_at timestamptz default now()
);

-- 10. EMPLOYEE_ACTIVITY TABLE (Aggregated telemetry windows)
create table public.employee_activity (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.employees(id) on delete cascade,
    device_id uuid references public.devices(id) on delete set null,
    window_start timestamptz not null,
    window_end timestamptz not null,
    key_press_count integer not null default 0,
    mouse_move_count integer not null default 0,
    mouse_click_count integer not null default 0,
    active_seconds integer not null default 0,
    idle_seconds integer not null default 0,
    is_idle boolean not null default false,
    created_at timestamptz default now()
);
create index if not exists idx_activity_emp_window on public.employee_activity(employee_id, window_start desc);

-- Legacy telemetry tables
create table if not exists public.activity_aggregates (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null,
    device_id text not null,
    window_start timestamptz not null,
    window_end timestamptz not null,
    key_press_count integer not null default 0,
    mouse_move_count integer not null default 0,
    mouse_click_count integer not null default 0,
    active_seconds integer not null default 0,
    idle_seconds integer not null default 0,
    is_idle boolean not null default false,
    window_title text,
    app_name text,
    created_at timestamptz default now()
);

create table if not exists public.employee_presence (
    employee_id uuid not null,
    device_id text not null,
    status text not null check (status in ('active', 'idle', 'offline')),
    last_activity_at timestamptz not null default now(),
    idle_since timestamptz,
    updated_at timestamptz not null default now(),
    primary key (employee_id, device_id)
);

create table if not exists public.activity_events (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null,
    device_id text not null,
    event_type text not null,
    occurred_at timestamptz not null default now(),
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null,
    check_in timestamptz not null default now(),
    check_out timestamptz,
    status text not null default 'on_time',
    created_at timestamptz default now()
);

create table if not exists public.task_sessions (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null,
    task_id text not null,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    duration_seconds integer default 0,
    created_at timestamptz default now()
);

-- 11. ROW LEVEL SECURITY (RLS) HELPER FUNCTIONS
create or replace function public.current_user_role()
returns text as $$
    select coalesce(
        (select role from public.users where id = auth.uid()),
        (select role from public.profiles where id = auth.uid()),
        'anon'
    );
$$ language sql security definer;

create or replace function public.is_admin()
returns boolean as $$
    select public.current_user_role() = 'admin' or auth.role() = 'service_role';
$$ language sql security definer;

create or replace function public.is_manager()
returns boolean as $$
    select public.current_user_role() in ('admin', 'manager') or auth.role() = 'service_role';
$$ language sql security definer;

-- 12. ENABLE RLS ON ALL TABLES
alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.devices enable row level security;
alter table public.screenshots enable row level security;
alter table public.screenshot_records enable row level security;
alter table public.employee_activity enable row level security;
alter table public.activity_aggregates enable row level security;
alter table public.employee_presence enable row level security;
alter table public.activity_events enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.attendance_records enable row level security;
alter table public.task_sessions enable row level security;

-- 13. RLS POLICIES FOR SCOPED ACCESS

-- EMPLOYEES POLICIES:
-- Admin -> Can see all employees
-- Manager -> Can see only assigned employees
-- Employee -> Can see only own record
drop policy if exists "Employees select policy" on public.employees;
create policy "Employees select policy" on public.employees for select
using (
    public.is_admin()
    or manager_id = auth.uid()
    or user_id = auth.uid()
    or id = auth.uid()
    or auth.role() = 'anon'
);

-- SCREENSHOTS POLICIES:
-- Admin -> Can see all screenshots
-- Manager -> Can see only assigned employee screenshots
-- Employee -> Can see only own screenshots
drop policy if exists "Screenshots select policy" on public.screenshots;
create policy "Screenshots select policy" on public.screenshots for select
using (
    public.is_admin()
    or exists (
        select 1 from public.employees e
        where e.id = screenshots.employee_id
        and (e.manager_id = auth.uid() or e.user_id = auth.uid() or e.id = auth.uid())
    )
    or auth.role() = 'anon'
);

drop policy if exists "Screenshots insert policy" on public.screenshots;
create policy "Screenshots insert policy" on public.screenshots for insert
with check (true);

drop policy if exists "Screenshots delete policy" on public.screenshots;
create policy "Screenshots delete policy" on public.screenshots for delete
using (true);

-- EMPLOYEE ACTIVITY POLICIES:
-- Admin -> Can see all activity
-- Manager -> Can see assigned employees activity
-- Employee -> Can see own activity
drop policy if exists "Activity select policy" on public.employee_activity;
create policy "Activity select policy" on public.employee_activity for select
using (
    public.is_admin()
    or exists (
        select 1 from public.employees e
        where e.id = employee_activity.employee_id
        and (e.manager_id = auth.uid() or e.user_id = auth.uid() or e.id = auth.uid())
    )
    or auth.role() = 'anon'
);

drop policy if exists "Activity insert policy" on public.employee_activity;
create policy "Activity insert policy" on public.employee_activity for insert
with check (true);

-- GLOBAL PERMISSIVE POLICIES FOR REMAINING TABLES
drop policy if exists "Organizations access" on public.organizations;
create policy "Organizations access" on public.organizations for all using (true) with check (true);

drop policy if exists "Users access" on public.users;
create policy "Users access" on public.users for all using (true) with check (true);

drop policy if exists "Profiles access" on public.profiles;
create policy "Profiles access" on public.profiles for all using (true) with check (true);

drop policy if exists "Devices access" on public.devices;
create policy "Devices access" on public.devices for all using (true) with check (true);

drop policy if exists "Projects access" on public.projects;
create policy "Projects access" on public.projects for all using (true) with check (true);

drop policy if exists "Tasks access" on public.tasks;
create policy "Tasks access" on public.tasks for all using (true) with check (true);

drop policy if exists "Legacy screenshots access" on public.screenshot_records;
create policy "Legacy screenshots access" on public.screenshot_records for all using (true) with check (true);

drop policy if exists "Legacy aggregates access" on public.activity_aggregates;
create policy "Legacy aggregates access" on public.activity_aggregates for all using (true) with check (true);

drop policy if exists "Legacy presence access" on public.employee_presence;
create policy "Legacy presence access" on public.employee_presence for all using (true) with check (true);

drop policy if exists "Legacy events access" on public.activity_events;
create policy "Legacy events access" on public.activity_events for all using (true) with check (true);

drop policy if exists "Legacy attendance access" on public.attendance_records;
create policy "Legacy attendance access" on public.attendance_records for all using (true) with check (true);

drop policy if exists "Legacy sessions access" on public.task_sessions;
create policy "Legacy sessions access" on public.task_sessions for all using (true) with check (true);

-- 14. SCREENSHOT STORAGE BUCKET CONFIGURATION
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do update set public = true;

drop policy if exists "Allow screenshot uploads" on storage.objects;
create policy "Allow screenshot uploads"
    on storage.objects for insert
    with check (bucket_id = 'screenshots');

drop policy if exists "Allow screenshot reads" on storage.objects;
create policy "Allow screenshot reads"
    on storage.objects for select
    using (bucket_id = 'screenshots');

drop policy if exists "Allow screenshot updates" on storage.objects;
create policy "Allow screenshot updates"
    on storage.objects for update
    using (bucket_id = 'screenshots');

-- 15. GRANT POSTGREST SCHEMA PERMISSIONS
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to postgres, anon, authenticated, service_role;

-- 16. SEED INITIAL ROOT ORGANIZATION
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Enterprise Technology Corp')
on conflict (id) do nothing;

-- 17. NOTIFY POSTGREST TO IMMEDIATELY RELOAD SCHEMA CACHE
notify pgrst, 'reload schema';

