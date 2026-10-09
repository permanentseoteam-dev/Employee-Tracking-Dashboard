-- Preferred short name shown in UI: first | last | full (default first)

alter table public.profiles
  add column if not exists display_name_pref text default 'first';

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    alter table public.users add column if not exists display_name_pref text default 'first';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'employees'
  ) then
    alter table public.employees add column if not exists display_name_pref text default 'first';
  end if;
end $$;
