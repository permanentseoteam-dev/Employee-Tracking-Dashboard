-- Global agent office-hours policy (single-row config the desktop agent can poll)

create table if not exists public.agent_runtime_config (
    id integer primary key default 1 check (id = 1),
    enabled boolean not null default true,
    work_start time not null default '09:00',
    work_end time not null default '17:00',
    work_days text[] not null default array['mon','tue','wed','thu','fri'],
    capture_outside_hours boolean not null default false,
    timezone_note text not null default 'Uses each workstation local clock',
    updated_at timestamptz not null default now()
);

insert into public.agent_runtime_config (id)
values (1)
on conflict (id) do nothing;

alter table public.agent_runtime_config enable row level security;

drop policy if exists "Allow select agent_runtime_config" on public.agent_runtime_config;
create policy "Allow select agent_runtime_config"
    on public.agent_runtime_config for select
    using (true);

drop policy if exists "Allow update agent_runtime_config" on public.agent_runtime_config;
create policy "Allow update agent_runtime_config"
    on public.agent_runtime_config for update
    using (true);

drop policy if exists "Allow insert agent_runtime_config" on public.agent_runtime_config;
create policy "Allow insert agent_runtime_config"
    on public.agent_runtime_config for insert
    with check (true);
