-- Seed dedicated Project Manager identity for projects.manager_id FK.
-- AuthContext demo PM id: eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee

do $$
begin
  begin
    alter table public.users drop constraint if exists users_role_check;
  exception when undefined_object then
    null;
  end;
  begin
    alter table public.users
      add constraint users_role_check
      check (role in ('admin', 'manager', 'project_manager', 'employee'));
  exception when duplicate_object then
    null;
  end;

  begin
    alter table public.profiles drop constraint if exists profiles_role_check;
  exception when undefined_object then
    null;
  end;
  begin
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('admin', 'manager', 'project_manager', 'employee'));
  exception when duplicate_object then
    null;
  end;
end $$;

insert into public.users (id, organization_id, email, full_name, role)
values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '00000000-0000-0000-0000-000000000001',
  'project.manager@company.com',
  'Arsal (Project Manager)',
  'project_manager'
)
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role;

insert into public.profiles (id, email, full_name, role, department)
values (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'project.manager@company.com',
  'Arsal (Project Manager)',
  'project_manager',
  'Delivery'
)
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  department = excluded.department;
