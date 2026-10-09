-- Allow project_manager in profiles.role (if constrained by check)
-- Safe no-op when constraint name differs or column is free-form text.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) then
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
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'role'
  ) then
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
  end if;
end $$;
