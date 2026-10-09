-- ==============================================================================
-- IMMEDIATE SUPABASE FIX: ROW-LEVEL SECURITY (RLS) & STORAGE POLICIES
-- Resolves Postgres Errors:
--   1. 42501: new row violates row-level security policy for table "objects"
--   2. 42501: new row violates row-level security policy for table "employees"
--   3. 23503: insert or update on table "employee_presence" violates FK constraint
--   4. 23503: insert or update on table "screenshot_records" violates FK constraint
--
-- Instructions: Run this in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. STORAGE BUCKETS: CREATE & CONFIGURE PUBLIC BUCKETS
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
    (
        'screenshots',
        'screenshots',
        true,
        52428800, -- 50 MB
        array['image/jpeg', 'image/png', 'image/webp', 'video/webm', 'video/mp4', 'application/json']
    ),
    (
        'recordings',
        'recordings',
        true,
        104857600, -- 100 MB
        array['video/webm', 'video/mp4', 'image/jpeg', 'image/png']
    )
on conflict (id) do update set 
    public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------------------------
-- 2. STORAGE RLS POLICIES ON storage.objects
-- Fixes: 42501 new row violates row-level security policy for table "objects"
-- ------------------------------------------------------------------------------
-- Clean up any conflicting old policies
drop policy if exists "Allow screenshot uploads" on storage.objects;
drop policy if exists "Allow screenshot reads" on storage.objects;
drop policy if exists "Allow screenshot updates" on storage.objects;
drop policy if exists "Screenshots Public Access" on storage.objects;
drop policy if exists "Screenshots Upload Access" on storage.objects;
drop policy if exists "Screenshots Update Access" on storage.objects;
drop policy if exists "Screenshots Public Select" on storage.objects;
drop policy if exists "Screenshots Public Insert" on storage.objects;
drop policy if exists "Screenshots Public Update" on storage.objects;
drop policy if exists "Screenshots Public Delete" on storage.objects;

drop policy if exists "Recordings Public Access" on storage.objects;
drop policy if exists "Recordings Upload Access" on storage.objects;
drop policy if exists "Recordings Update Access" on storage.objects;
drop policy if exists "Recordings Public Select" on storage.objects;
drop policy if exists "Recordings Public Insert" on storage.objects;
drop policy if exists "Recordings Public Update" on storage.objects;
drop policy if exists "Recordings Public Delete" on storage.objects;

-- Create comprehensive SELECT, INSERT, UPDATE, DELETE policies for screenshots
create policy "Screenshots Public Select" 
    on storage.objects for select 
    using (bucket_id = 'screenshots');

create policy "Screenshots Public Insert" 
    on storage.objects for insert 
    with check (bucket_id = 'screenshots');

create policy "Screenshots Public Update" 
    on storage.objects for update 
    using (bucket_id = 'screenshots');

create policy "Screenshots Public Delete" 
    on storage.objects for delete 
    using (bucket_id = 'screenshots');

-- Create comprehensive SELECT, INSERT, UPDATE, DELETE policies for recordings
create policy "Recordings Public Select" 
    on storage.objects for select 
    using (bucket_id = 'recordings');

create policy "Recordings Public Insert" 
    on storage.objects for insert 
    with check (bucket_id = 'recordings');

create policy "Recordings Public Update" 
    on storage.objects for update 
    using (bucket_id = 'recordings');

create policy "Recordings Public Delete" 
    on storage.objects for delete 
    using (bucket_id = 'recordings');

-- ------------------------------------------------------------------------------
-- 3. EMPLOYEES TABLE RLS POLICIES
-- Fixes: 42501 new row violates row-level security policy for table "employees"
-- ------------------------------------------------------------------------------
alter table public.employees enable row level security;

drop policy if exists "Employees select policy" on public.employees;
create policy "Employees select policy" 
    on public.employees for select 
    using (true);

drop policy if exists "Employees insert policy" on public.employees;
create policy "Employees insert policy" 
    on public.employees for insert 
    with check (true);

drop policy if exists "Employees update policy" on public.employees;
create policy "Employees update policy" 
    on public.employees for update 
    using (true) 
    with check (true);

drop policy if exists "Employees delete policy" on public.employees;
create policy "Employees delete policy" 
    on public.employees for delete 
    using (true);

-- ------------------------------------------------------------------------------
-- 4. TELEMETRY & PRESENCE TABLES RLS POLICIES
-- ------------------------------------------------------------------------------
alter table public.employee_presence enable row level security;
drop policy if exists "Employees can insert or update own presence" on public.employee_presence;
drop policy if exists "Managers and Admins can view employee presence" on public.employee_presence;
drop policy if exists "Legacy presence access" on public.employee_presence;
drop policy if exists "Presence all access" on public.employee_presence;
create policy "Presence all access" 
    on public.employee_presence for all 
    using (true) 
    with check (true);

alter table public.screenshot_records enable row level security;
drop policy if exists "Legacy screenshots access" on public.screenshot_records;
drop policy if exists "Screenshot records all access" on public.screenshot_records;
create policy "Screenshot records all access" 
    on public.screenshot_records for all 
    using (true) 
    with check (true);

alter table public.activity_events enable row level security;
drop policy if exists "Legacy events access" on public.activity_events;
drop policy if exists "Activity events all access" on public.activity_events;
create policy "Activity events all access" 
    on public.activity_events for all 
    using (true) 
    with check (true);

alter table public.activity_aggregates enable row level security;
drop policy if exists "Legacy aggregates access" on public.activity_aggregates;
drop policy if exists "Activity aggregates all access" on public.activity_aggregates;
create policy "Activity aggregates all access" 
    on public.activity_aggregates for all 
    using (true) 
    with check (true);

-- ------------------------------------------------------------------------------
-- 5. SEED FALLBACK AGENT PROFILE TO SATISFY FOREIGN KEY CONSTRAINTS
-- Fixes: 23503 foreign key constraint violations on employee_presence and screenshot_records
-- ------------------------------------------------------------------------------
-- Ensure organization exists
insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Enterprise Technology Corp')
on conflict (id) do nothing;

-- Ensure manager exists
insert into public.users (id, organization_id, email, full_name, role)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000001', 'arsal.manager@company.com', 'Arsal (Manager)', 'manager')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role, department)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'arsal.manager@company.com', 'Arsal (Manager)', 'manager', 'Management')
on conflict (id) do nothing;

-- Ensure primary employee Arsal exists
insert into public.users (id, organization_id, email, full_name, role)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000001', 'arsal@company.com', 'Arsal', 'employee')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role, department)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'arsal@company.com', 'Arsal', 'employee', 'Engineering')
on conflict (id) do nothing;

insert into public.employees (id, user_id, organization_id, manager_id, full_name, email, department, status)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Arsal', 'arsal@company.com', 'Engineering', 'active')
on conflict (id) do update set status = 'active';

-- Seed desktop agent fallback profile d9b4bfb3-9953-522d-84af-3de709e7caa8
insert into public.users (id, organization_id, email, full_name, role)
values ('d9b4bfb3-9953-522d-84af-3de709e7caa8', '00000000-0000-0000-0000-000000000001', 'arsal.agent@company.com', 'Arsal (Agent)', 'employee')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, role, department)
values ('d9b4bfb3-9953-522d-84af-3de709e7caa8', 'arsal.agent@company.com', 'Arsal (Agent)', 'employee', 'Engineering')
on conflict (id) do update set full_name = 'Arsal (Agent)', role = 'employee', department = 'Engineering';

insert into public.employees (id, user_id, organization_id, manager_id, full_name, email, department, status)
values ('d9b4bfb3-9953-522d-84af-3de709e7caa8', 'd9b4bfb3-9953-522d-84af-3de709e7caa8', '00000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Arsal (Agent)', 'arsal.agent@company.com', 'Engineering', 'active')
on conflict (id) do update set status = 'active';

-- ------------------------------------------------------------------------------
-- 6. GRANT ALL PERMISSIONS & NOTIFY POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;

grant usage on schema storage to postgres, anon, authenticated, service_role;
grant all on all tables in schema storage to postgres, anon, authenticated, service_role;
grant all on all sequences in schema storage to postgres, anon, authenticated, service_role;

notify pgrst, 'reload schema';
