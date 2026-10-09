-- Persist stars, rules, payroll, messages, and teams (replace in-memory / localStorage seeds)

create table if not exists public.star_rules (
    id text primary key,
    name text not null,
    condition text not null default '',
    star_delta integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.employee_star_balances (
    employee_id text primary key,
    stars integer not null default 0 check (stars >= 0),
    updated_at timestamptz not null default now()
);

create table if not exists public.star_award_events (
    id uuid primary key default gen_random_uuid(),
    employee_id text not null,
    star_delta integer not null,
    reason text not null default '',
    awarded_by text not null default '',
    awarded_by_role text not null default 'admin',
    created_at timestamptz not null default now()
);

create table if not exists public.attendance_rule_config (
    id integer primary key default 1 check (id = 1),
    work_start_time text not null default '09:00',
    work_end_time text not null default '17:00',
    grace_period_minutes integer not null default 15,
    late_threshold_minutes integer not null default 30,
    updated_at timestamptz not null default now()
);

insert into public.attendance_rule_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.employee_salaries (
    id text primary key,
    employee_id text not null,
    employee_name text not null,
    email text not null default '',
    department text not null default '',
    team_name text not null default '',
    base_salary numeric not null default 0,
    currency text not null default 'USD',
    pay_frequency text not null default 'monthly',
    bonus_amount numeric not null default 0,
    deduction_amount numeric not null default 0,
    net_salary numeric not null default 0,
    payment_status text not null default 'scheduled',
    next_pay_date text,
    bank_account_mask text,
    last_payment_date text,
    notes text,
    updated_at timestamptz not null default now()
);

create table if not exists public.confidential_messages (
    id text primary key,
    recipient_id text not null,
    recipient_name text not null,
    recipient_email text,
    sender_id text not null,
    sender_name text not null,
    sender_role text not null default 'admin',
    subject text not null,
    message_body text not null,
    salary_slip_reference jsonb,
    sent_at timestamptz not null default now(),
    is_read boolean not null default false,
    priority text not null default 'normal'
);

create table if not exists public.teams (
    id text primary key,
    name text not null,
    department text not null default '',
    manager_id text,
    manager_name text,
    member_count integer not null default 0,
    active_count integer not null default 0,
    attendance_rate numeric not null default 0,
    project_ids text[] not null default '{}',
    created_at timestamptz not null default now()
);

alter table public.star_rules enable row level security;
alter table public.employee_star_balances enable row level security;
alter table public.star_award_events enable row level security;
alter table public.attendance_rule_config enable row level security;
alter table public.employee_salaries enable row level security;
alter table public.confidential_messages enable row level security;
alter table public.teams enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'star_rules','employee_star_balances','star_award_events',
    'attendance_rule_config','employee_salaries','confidential_messages','teams'
  ]
  loop
    execute format('drop policy if exists "Allow all %1$s" on public.%1$I', t);
    execute format(
      'create policy "Allow all %1$s" on public.%1$I for all using (true) with check (true)',
      t
    );
  end loop;
end $$;

insert into public.star_rules (id, name, condition, star_delta, is_active) values
  ('sr-1', 'On-Time Daily Check-in', 'First activity before 09:00 AM', 1, true),
  ('sr-2', 'Sprint Task Completion', 'All assigned sprint tasks completed', 3, true),
  ('sr-3', 'Extended Unexcused Inactivity', 'Idle > 90 minutes during work hours', -1, true),
  ('sr-4', 'Late Arrival (>30m)', 'Check-in past 09:30 AM without notice', -1, true),
  ('sr-5', 'Exemplary Sprint Performance', 'Manager manual award', 5, true)
on conflict (id) do nothing;
