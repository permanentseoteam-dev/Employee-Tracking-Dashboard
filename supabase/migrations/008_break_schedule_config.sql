-- Organization-wide coffee & prayer break schedule (single-row admin config)

create table if not exists public.break_schedule_config (
    id integer primary key default 1 check (id = 1),
    coffee_enabled boolean not null default true,
    coffee_label text not null default 'Coffee Break',
    coffee_start time not null default '11:00',
    coffee_end time not null default '11:30',
    zuhr_enabled boolean not null default true,
    zuhr_label text not null default 'Zuhr Namaz & Lunch',
    zuhr_start time not null default '13:00',
    zuhr_end time not null default '14:00',
    asr_enabled boolean not null default true,
    asr_label text not null default 'Asr Prayer',
    asr_start time not null default '16:30',
    asr_end time not null default '16:45',
    updated_at timestamptz not null default now()
);

insert into public.break_schedule_config (id)
values (1)
on conflict (id) do nothing;

alter table public.break_schedule_config enable row level security;

drop policy if exists "Allow select break_schedule_config" on public.break_schedule_config;
create policy "Allow select break_schedule_config"
    on public.break_schedule_config for select
    using (true);

drop policy if exists "Allow update break_schedule_config" on public.break_schedule_config;
create policy "Allow update break_schedule_config"
    on public.break_schedule_config for update
    using (true);

drop policy if exists "Allow insert break_schedule_config" on public.break_schedule_config;
create policy "Allow insert break_schedule_config"
    on public.break_schedule_config for insert
    with check (true);
