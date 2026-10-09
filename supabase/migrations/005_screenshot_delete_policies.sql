-- Allow deleting screenshot objects and DB rows (admin UI purge)

drop policy if exists "Screenshots Delete Access" on storage.objects;
create policy "Screenshots Delete Access"
    on storage.objects for delete
    using (bucket_id = 'screenshots');

drop policy if exists "Recordings Delete Access" on storage.objects;
create policy "Recordings Delete Access"
    on storage.objects for delete
    using (bucket_id = 'recordings');

-- screenshot_records / screenshots delete policies (tables may use RLS)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'screenshot_records'
  ) then
    execute 'alter table public.screenshot_records enable row level security';
    execute 'drop policy if exists "Allow delete screenshot_records" on public.screenshot_records';
    execute 'create policy "Allow delete screenshot_records" on public.screenshot_records for delete using (true)';
    execute 'drop policy if exists "Allow select screenshot_records" on public.screenshot_records';
    execute 'create policy "Allow select screenshot_records" on public.screenshot_records for select using (true)';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'screenshots'
  ) then
    execute 'alter table public.screenshots enable row level security';
    execute 'drop policy if exists "Allow delete screenshots" on public.screenshots';
    execute 'create policy "Allow delete screenshots" on public.screenshots for delete using (true)';
    execute 'drop policy if exists "Allow select screenshots" on public.screenshots';
    execute 'create policy "Allow select screenshots" on public.screenshots for select using (true)';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'screen_recordings'
  ) then
    execute 'drop policy if exists "Allow delete screen recordings" on public.screen_recordings';
    execute 'create policy "Allow delete screen recordings" on public.screen_recordings for delete using (true)';
  end if;
end $$;
