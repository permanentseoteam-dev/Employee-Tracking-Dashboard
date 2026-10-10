-- Live screen sessions + agent command channel + frame-sequence recordings

-- 1. Commands from admin/manager UI -> employee-agent
create table if not exists public.agent_commands (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null,
  command text not null check (command in ('start_live', 'stop_live', 'record')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed')),
  requested_by text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_commands_pending
  on public.agent_commands (employee_id, status, created_at);

alter table public.agent_commands enable row level security;

drop policy if exists "Agent commands all access" on public.agent_commands;
create policy "Agent commands all access"
  on public.agent_commands for all
  using (true)
  with check (true);

-- 2. Live session state (latest frame pointer)
create table if not exists public.employee_live_sessions (
  employee_id uuid primary key,
  active boolean not null default false,
  storage_path text,
  width integer,
  height integer,
  viewer_id text,
  updated_at timestamptz not null default now()
);

alter table public.employee_live_sessions enable row level security;

drop policy if exists "Live sessions all access" on public.employee_live_sessions;
create policy "Live sessions all access"
  on public.employee_live_sessions for all
  using (true)
  with check (true);

-- 3. Frame-sequence recordings (no video encoder required on agent)
alter table public.screen_recordings
  add column if not exists frame_manifest jsonb;

comment on column public.screen_recordings.frame_manifest is
  'Ordered JPEG frame paths + fps for sequence playback, e.g. {"fps":2,"frames":["recordings/.../frame_0001.jpg"]}';
