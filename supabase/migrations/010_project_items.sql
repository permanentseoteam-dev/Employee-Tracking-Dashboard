-- Nested project folders & files (Drive-style tree)

create table if not exists public.project_items (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    parent_id uuid references public.project_items(id) on delete cascade,
    item_type text not null check (item_type in ('folder', 'embed', 'uploaded_file', 'document', 'spreadsheet', 'presentation')),
    name text not null,
    embed_url text,
    content jsonb default '{}'::jsonb,
    storage_path text,
    data_url text,
    mime_type text,
    external_provider text,
    external_file_id text,
    created_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint project_items_name_not_blank check (length(trim(name)) > 0)
);

create index if not exists idx_project_items_project on public.project_items(project_id);
create index if not exists idx_project_items_parent on public.project_items(parent_id);
create index if not exists idx_project_items_type on public.project_items(item_type);

-- Same-project parent enforcement via trigger
create or replace function public.project_items_same_project_parent()
returns trigger
language plpgsql
as $$
declare
  parent_project uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'project_items: circular parent reference';
  end if;
  select project_id into parent_project from public.project_items where id = new.parent_id;
  if parent_project is null then
    raise exception 'project_items: parent not found';
  end if;
  if parent_project <> new.project_id then
    raise exception 'project_items: parent must belong to the same project';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_project_items_same_project on public.project_items;
create trigger trg_project_items_same_project
  before insert or update of parent_id, project_id
  on public.project_items
  for each row execute function public.project_items_same_project_parent();

alter table public.project_items enable row level security;

drop policy if exists "project_items_select" on public.project_items;
create policy "project_items_select" on public.project_items for select using (true);

drop policy if exists "project_items_insert" on public.project_items;
create policy "project_items_insert" on public.project_items for insert with check (true);

drop policy if exists "project_items_update" on public.project_items;
create policy "project_items_update" on public.project_items for update using (true) with check (true);

drop policy if exists "project_items_delete" on public.project_items;
create policy "project_items_delete" on public.project_items for delete using (true);

-- Note: policies mirror existing projects access (open) so the app keeps working.
-- Tighten to auth.uid() / workspace membership when org auth is fully enforced.
