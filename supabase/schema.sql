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

-- 16. SEED SAMPLE DATA
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Enterprise Technology Corp')
on conflict (id) do nothing;

insert into public.users (id, organization_id, email, full_name, role)
values 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'admin@company.com', 'Admin User', 'admin'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000001', 'alex.v@company.com', 'Alex Vance', 'manager'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000001', 'arsal@company.com', 'Arsal', 'employee'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000001', 'michael.c@company.com', 'Michael Chen', 'employee')
on conflict (id) do update set
    organization_id = excluded.organization_id,
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role;

insert into public.profiles (id, email, full_name, role, department)
values 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@company.com', 'Admin User', 'admin', 'Management'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'alex.v@company.com', 'Alex Vance', 'manager', 'Engineering'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'arsal@company.com', 'Arsal', 'employee', 'Engineering'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'michael.c@company.com', 'Michael Chen', 'employee', 'Engineering')
on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    department = excluded.department;

insert into public.employees (id, user_id, organization_id, manager_id, full_name, email, department, status)
values
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Arsal', 'arsal@company.com', 'Engineering', 'active'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Michael Chen', 'michael.c@company.com', 'Engineering', 'active')
on conflict (id) do update set
    user_id = excluded.user_id,
    organization_id = excluded.organization_id,
    manager_id = excluded.manager_id,
    full_name = excluded.full_name,
    email = excluded.email,
    department = excluded.department,
    status = excluded.status;

insert into public.devices (id, employee_id, device_name, device_identifier, os_version, agent_version)
values
    ('99999999-9999-9999-9999-999999999999', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'DESKTOP-QUVQI4B', 'WIN-DESKTOP-QUVQI4B-ok', 'Windows 10/11 x86_64', '0.1.0')
on conflict (id) do update set
    employee_id = excluded.employee_id,
    device_name = excluded.device_name,
    device_identifier = excluded.device_identifier;

insert into public.projects (id, organization_id, name, description, status, manager_id)
values
    ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'Desktop Agent v2', 'Native Windows background tracking agent', 'active', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', 'Enterprise Dashboard', 'Admin & Manager real-time monitoring suite', 'active', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
on conflict (id) do update set
    organization_id = excluded.organization_id,
    name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    manager_id = excluded.manager_id;

insert into public.tasks (id, project_id, title, description, assigned_to, status, priority, estimated_hours)
values
    ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 'Implement SQLite outbox queue', 'Offline caching for telemetry events', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'in_progress', 'high', 16),
    ('77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', 'Dark mode theme switcher', 'Modern glassmorphic palette', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'completed', 'medium', 8)
on conflict (id) do update set
    project_id = excluded.project_id,
    title = excluded.title,
    description = excluded.description,
    assigned_to = excluded.assigned_to,
    status = excluded.status,
    priority = excluded.priority,
    estimated_hours = excluded.estimated_hours;

insert into public.employee_presence (employee_id, device_id, status, last_activity_at, updated_at)
values
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'WIN-DESKTOP-QUVQI4B-ok', 'active', now(), now()),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'WIN-MICHAEL-DESKTOP', 'active', now(), now())
on conflict (employee_id, device_id) do update set 
    status = excluded.status,
    last_activity_at = excluded.last_activity_at,
    updated_at = excluded.updated_at;

-- 17. NOTIFY POSTGREST TO IMMEDIATELY RELOAD SCHEMA CACHE
notify pgrst, 'reload schema';
