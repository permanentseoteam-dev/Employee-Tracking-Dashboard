-- ==============================================================================
-- MIGRATION 014: AUTOMATIC SUPABASE AUTH USER SYNCHRONIZATION & CLEANUP
-- Automatically provisions profiles, users, and employees whenever a user registers
-- ==============================================================================

-- 1. Remove all legacy dummy seed records from public tables (excluding active agent ccc...)
delete from public.employee_presence where employee_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
);

delete from public.devices where employee_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
);

update public.tasks set assigned_to = null where assigned_to in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
);

update public.projects set manager_id = null where manager_id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
);

delete from public.employees where id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
);

delete from public.profiles where id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
);

delete from public.users where id in (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
);

-- 2. Create trigger function to auto-sync every new auth.users signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_role text;
  user_name text;
  user_dept text;
begin
  user_role := coalesce(new.raw_user_meta_data->>'role', 'employee');
  user_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  user_dept := coalesce(new.raw_user_meta_data->>'department', 'General');

  -- Upsert into public.profiles
  insert into public.profiles (id, email, full_name, role, department, updated_at)
  values (new.id, new.email, user_name, user_role, user_dept, now())
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    department = excluded.department,
    updated_at = now();

  -- Upsert into public.users
  insert into public.users (id, organization_id, email, full_name, role, department, updated_at)
  values (new.id, '00000000-0000-0000-0000-000000000001', new.email, user_name, user_role, user_dept, now())
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    department = excluded.department,
    updated_at = now();

  -- Upsert into public.employees if role is employee
  if user_role = 'employee' then
    insert into public.employees (id, user_id, organization_id, full_name, email, department, status, updated_at)
    values (new.id, new.id, '00000000-0000-0000-0000-000000000001', user_name, new.email, user_dept, 'active', now())
    on conflict (id) do update set
      full_name = excluded.full_name,
      email = excluded.email,
      department = excluded.department,
      status = 'active',
      updated_at = now();
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 3. Attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Notify PostgREST cache reload
notify pgrst, 'reload schema';
