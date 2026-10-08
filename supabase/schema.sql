-- ==============================================================================
-- SUPABASE POSTGRESQL SCHEMA FOR EMPLOYEE TRACKING SYSTEM
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

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
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
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

-- 10. AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP
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
    on conflict (id) do nothing;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- 11. ENABLE ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_sessions enable row level security;
alter table public.activity_aggregates enable row level security;
alter table public.attendance_records enable row level security;
alter table public.screenshot_records enable row level security;

-- Helper function to check if caller is an admin
create or replace function public.is_admin()
returns boolean as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    );
$$ language sql security definer;

-- Helper function to check if caller is a manager
create or replace function public.is_manager()
returns boolean as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role in ('admin', 'manager')
    );
$$ language sql security definer;

-- POLICIES: PROFILES
create policy "Users can view own profile or admins/managers can view all"
    on public.profiles for select
    using (auth.uid() = id or public.is_manager());

create policy "Users can update own profile"
    on public.profiles for update
    using (auth.uid() = id or public.is_admin());

-- POLICIES: ACTIVITY & ATTENDANCE & SESSIONS
create policy "Employees can insert their own telemetry"
    on public.activity_aggregates for insert
    with check (auth.uid() = employee_id);

create policy "Employees see own activity, managers/admins see team"
    on public.activity_aggregates for select
    using (auth.uid() = employee_id or public.is_manager());

create policy "Employees can insert attendance"
    on public.attendance_records for insert
    with check (auth.uid() = employee_id);

create policy "Employees see own attendance, managers/admins see all"
    on public.attendance_records for select
    using (auth.uid() = employee_id or public.is_manager());

create policy "Task sessions access"
    on public.task_sessions for all
    using (auth.uid() = employee_id or public.is_manager())
    with check (auth.uid() = employee_id or public.is_manager());

create policy "Screenshot access"
    on public.screenshot_records for all
    using (auth.uid() = employee_id or public.is_manager())
    with check (auth.uid() = employee_id);

-- 12. SCREENSHOT STORAGE BUCKET
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload screenshots"
    on storage.objects for insert
    with check (bucket_id = 'screenshots' and auth.role() = 'authenticated');

create policy "Users can read screenshots based on role"
    on storage.objects for select
    using (bucket_id = 'screenshots' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_manager()));
