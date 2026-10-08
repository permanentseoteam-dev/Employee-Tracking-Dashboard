-- ==============================================================================
-- SUPABASE COMPLETE POSTGRESQL SCHEMA FOR EMPLOYEE TRACKING SYSTEM
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/isywkcymfzpgjerfuors
-- 2. Go to "SQL Editor" on the left menu.
-- 3. Click "New Query", paste this entire file content, and click "Run" (Ctrl+Enter).
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- 2. TEAMS TABLE
create table if not exists public.teams (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    manager_id uuid, -- linked to public.profiles later
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 3. PROFILES TABLE (Mirrors and extends auth.users)
create table if not exists public.profiles (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    full_name text not null default '',
    role text not null check (role in ('admin', 'manager', 'employee')) default 'employee',
    department text default 'Engineering',
    team_id uuid references public.teams(id) on delete set null,
    avatar_url text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Link manager_id foreign key now that profiles table exists
alter table public.teams 
    drop constraint if exists fk_teams_manager,
    add constraint fk_teams_manager foreign key (manager_id) references public.profiles(id) on delete set null;

-- 4. PROJECTS TABLE
create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text default '',
    status text not null default 'active' check (status in ('active', 'paused', 'completed')),
    team_id uuid references public.teams(id) on delete set null,
    created_at timestamptz default now()
);

-- 5. TASKS TABLE
create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references public.projects(id) on delete cascade,
    title text not null,
    description text default '',
    assigned_to uuid references public.profiles(id) on delete set null,
    status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
    estimated_hours numeric default 0,
    created_at timestamptz default now()
);

-- 6. TASK SESSIONS (Work sessions & timer records synced from desktop)
create table if not exists public.task_sessions (
    id uuid primary key default gen_random_uuid(),
    task_id uuid references public.tasks(id) on delete set null,
    task_title text not null,
    project_name text,
    employee_id uuid not null references public.profiles(id) on delete cascade,
    start_time timestamptz not null,
    end_time timestamptz,
    total_seconds integer not null default 0,
    break_seconds integer not null default 0,
    status text not null default 'completed',
    created_at timestamptz default now()
);

-- 7. ACTIVITY AGGREGATES (60-second summary telemetry windows from desktop outbox)
create table if not exists public.activity_aggregates (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.profiles(id) on delete cascade,
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
create index if not exists idx_activity_employee_window on public.activity_aggregates(employee_id, window_start desc);

-- 8. ATTENDANCE RECORDS (Punches & shifts synced from desktop)
create table if not exists public.attendance_records (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.profiles(id) on delete cascade,
    device_id text not null,
    date date not null,
    first_activity_at timestamptz not null,
    event_type text not null, -- 'punch_in', 'punch_out', 'break_start', 'break_end'
    status text not null default 'verified',
    created_at timestamptz default now()
);
create index if not exists idx_attendance_employee_date on public.attendance_records(employee_id, date desc);

-- 9. SCREENSHOT RECORDS (Metadata linking to Supabase storage bucket)
create table if not exists public.screenshot_records (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public.profiles(id) on delete cascade,
    device_id text not null,
    captured_at timestamptz not null,
    storage_path text not null,
    thumbnail_path text,
    file_size_bytes bigint not null default 0,
    created_at timestamptz default now()
);
create index if not exists idx_screenshots_employee on public.screenshot_records(employee_id, captured_at desc);

-- 10. EMPLOYEE PRESENCE TABLE
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

-- 11. ACTIVITY EVENTS TABLE (Lightweight event stream)
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

-- 12. AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, email, full_name, role)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data->>'role', 'employee')
    )
    on conflict (id) do update set
        email = excluded.email,
        full_name = coalesce(excluded.full_name, profiles.full_name),
        role = coalesce(excluded.role, profiles.role),
        updated_at = now();
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- 13. ENABLE ROW LEVEL SECURITY (RLS) & SET PERMISSIVE POLICIES
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_sessions enable row level security;
alter table public.activity_aggregates enable row level security;
alter table public.attendance_records enable row level security;
alter table public.screenshot_records enable row level security;
alter table public.employee_presence enable row level security;
alter table public.activity_events enable row level security;

-- Helper functions for RLS
create or replace function public.is_admin()
returns boolean as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    );
$$ language sql security definer;

create or replace function public.is_manager()
returns boolean as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role in ('admin', 'manager')
    );
$$ language sql security definer;

-- Drop existing policies if any to prevent conflicts
drop policy if exists "Profiles select policy" on public.profiles;
drop policy if exists "Profiles insert policy" on public.profiles;
drop policy if exists "Profiles update policy" on public.profiles;
drop policy if exists "Teams access policy" on public.teams;
drop policy if exists "Projects access policy" on public.projects;
drop policy if exists "Tasks access policy" on public.tasks;
drop policy if exists "Task sessions access policy" on public.task_sessions;
drop policy if exists "Activity aggregates access policy" on public.activity_aggregates;
drop policy if exists "Attendance records access policy" on public.attendance_records;
drop policy if exists "Screenshot records access policy" on public.screenshot_records;
drop policy if exists "Employee presence access policy" on public.employee_presence;
drop policy if exists "Activity events access policy" on public.activity_events;

-- Policies allowing both authenticated users and anon development
create policy "Profiles select policy" on public.profiles for select using (true);
create policy "Profiles insert policy" on public.profiles for insert with check (true);
create policy "Profiles update policy" on public.profiles for update using (true);

create policy "Teams access policy" on public.teams for all using (true) with check (true);
create policy "Projects access policy" on public.projects for all using (true) with check (true);
create policy "Tasks access policy" on public.tasks for all using (true) with check (true);
create policy "Task sessions access policy" on public.task_sessions for all using (true) with check (true);
create policy "Activity aggregates access policy" on public.activity_aggregates for all using (true) with check (true);
create policy "Attendance records access policy" on public.attendance_records for all using (true) with check (true);
create policy "Screenshot records access policy" on public.screenshot_records for all using (true) with check (true);
create policy "Employee presence access policy" on public.employee_presence for all using (true) with check (true);
create policy "Activity events access policy" on public.activity_events for all using (true) with check (true);

-- 14. SCREENSHOT STORAGE BUCKET
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

drop policy if exists "Allow screenshot uploads" on storage.objects;
create policy "Allow screenshot uploads"
    on storage.objects for insert
    with check (bucket_id = 'screenshots');

drop policy if exists "Allow screenshot reads" on storage.objects;
create policy "Allow screenshot reads"
    on storage.objects for select
    using (bucket_id = 'screenshots');

-- 15. GRANT SCHEMA AND TABLE PERMISSIONS TO POSTGREST ROLES
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to postgres, anon, authenticated, service_role;

-- 16. SEED INITIAL SAMPLE DATA
insert into public.teams (id, name)
values 
    ('11111111-1111-1111-1111-111111111111', 'Core Backend Team'),
    ('22222222-2222-2222-2222-222222222222', 'Design & Web Platform'),
    ('33333333-3333-3333-3333-333333333333', 'Security & Infrastructure')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role, department, team_id)
values 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@company.com', 'Admin User', 'admin', 'Operations', null),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'alex.v@company.com', 'Alex Vance', 'manager', 'Engineering', '11111111-1111-1111-1111-111111111111'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'sarah.c@company.com', 'Sarah Connor', 'employee', 'Engineering', '11111111-1111-1111-1111-111111111111'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'michael.c@company.com', 'Michael Chen', 'employee', 'Engineering', '11111111-1111-1111-1111-111111111111')
on conflict (id) do nothing;

update public.teams set manager_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where id = '11111111-1111-1111-1111-111111111111';

insert into public.projects (id, name, description, status, team_id)
values
    ('44444444-4444-4444-4444-444444444444', 'Desktop Agent v2', 'Native Windows background tracking agent', 'active', '11111111-1111-1111-1111-111111111111'),
    ('55555555-5555-5555-5555-555555555555', 'Enterprise Dashboard', 'Admin & Manager real-time monitoring suite', 'active', '22222222-2222-2222-2222-222222222222')
on conflict (id) do nothing;

insert into public.tasks (id, project_id, title, description, assigned_to, status, priority, estimated_hours)
values
    ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 'Implement SQLite outbox queue', 'Offline caching for telemetry events', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'in_progress', 'high', 16),
    ('77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', 'Dark mode theme switcher', 'Modern glassmorphic palette', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'completed', 'medium', 8)
on conflict (id) do nothing;

-- 17. NOTIFY POSTGREST TO IMMEDIATELY RELOAD SCHEMA CACHE
notify pgrst, 'reload schema';
