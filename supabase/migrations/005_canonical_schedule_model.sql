-- Canonical model required by MarketSync_Especificacao_Definitiva v1.0.

create type public.schedule_status as enum ('draft', 'validating', 'has_conflicts', 'ready', 'pending_approval', 'approved', 'published', 'superseded', 'archived');
create type public.schedule_day_type as enum ('work', 'off', 'vacation', 'leave', 'absence');
create type public.validation_status as enum ('pending', 'running', 'passed', 'failed', 'superseded');
create type public.violation_severity as enum ('info', 'warning', 'critical');

create table public.rule_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  version integer not null default 1,
  effective_from date not null,
  effective_to date,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, name, version)
);

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  rule_set_id uuid not null references public.rule_sets(id) on delete cascade,
  code text not null,
  severity public.violation_severity not null,
  blocking boolean not null default false,
  parameters jsonb not null default '{}'::jsonb,
  scope jsonb not null default '{}'::jsonb,
  legal_basis text,
  unique (rule_set_id, code)
);

create table public.employment_contracts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  start_date date not null,
  end_date date,
  weekly_minutes integer not null default 2640,
  rule_set_id uuid references public.rule_sets(id),
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table public.employee_constraints (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  type text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  check (end_at is null or end_at >= start_at)
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  week_start date not null,
  status public.schedule_status not null default 'draft',
  revision integer not null default 1,
  rule_set_id uuid references public.rule_sets(id),
  legacy_schedule_week_id uuid unique references public.schedule_weeks(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, week_start)
);

create table public.schedule_versions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  number integer not null,
  snapshot jsonb not null,
  checksum text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (schedule_id, number),
  unique (schedule_id, checksum)
);

create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  work_date date not null,
  day_type public.schedule_day_type not null default 'work',
  note text,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, employee_id, work_date)
);

create table public.shift_segments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.schedule_entries(id) on delete cascade,
  sequence smallint not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at),
  unique (entry_id, sequence)
);

create table public.validation_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  schedule_revision integer not null,
  rule_set_id uuid references public.rule_sets(id),
  status public.validation_status not null default 'pending',
  checksum text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.violations (
  id uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references public.validation_runs(id) on delete cascade,
  employee_id uuid references public.employees(id),
  entry_id uuid references public.schedule_entries(id),
  rule_code text not null,
  severity public.violation_severity not null,
  blocking boolean not null,
  evidence jsonb not null default '{}'::jsonb,
  message text not null,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  resolution_note text
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  schedule_version_id uuid not null references public.schedule_versions(id) on delete cascade,
  approver_id uuid not null references public.profiles(id),
  decision text not null check (decision in ('approved', 'rejected')),
  reason text,
  created_at timestamptz not null default now()
);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  schedule_version_id uuid not null unique references public.schedule_versions(id) on delete restrict,
  published_by uuid not null references public.profiles(id),
  published_at timestamptz not null default now(),
  idempotency_key uuid unique not null default gen_random_uuid()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  channel text not null,
  status text not null default 'pending',
  provider_status jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.acknowledgements (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (publication_id, employee_id)
);

create index schedule_entries_schedule_date_idx on public.schedule_entries(schedule_id, work_date);
create index shift_segments_entry_time_idx on public.shift_segments(entry_id, starts_at, ends_at);
create index violations_run_idx on public.violations(validation_run_id, severity);

-- Migrate legacy weekly rows and their fixed two-period shifts into the canonical model.
insert into public.schedules (store_id, week_start, status, revision, legacy_schedule_week_id, created_by, created_at, updated_at)
select store_id, week_start,
  case state when 'published' then 'published'::public.schedule_status else 'draft'::public.schedule_status end,
  revision, id, created_by, now(), updated_at
from public.schedule_weeks
on conflict (legacy_schedule_week_id) do nothing;

insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type, created_at, updated_at)
select s.id, sh.employee_id, sh.work_date,
  case when sh.status = 'off' then 'off'::public.schedule_day_type else 'work'::public.schedule_day_type end,
  sh.created_at, sh.updated_at
from public.shifts sh
join public.schedules s on s.legacy_schedule_week_id = sh.schedule_week_id
on conflict (schedule_id, employee_id, work_date) do nothing;

insert into public.shift_segments (entry_id, sequence, starts_at, ends_at)
select e.id, 1,
  ((sh.work_date + sh.starts_at) at time zone coalesce(st.timezone, 'America/Sao_Paulo')),
  ((sh.work_date + sh.break_starts_at) at time zone coalesce(st.timezone, 'America/Sao_Paulo'))
from public.shifts sh join public.schedules s on s.legacy_schedule_week_id = sh.schedule_week_id
join public.stores st on st.id = s.store_id
join public.schedule_entries e on e.schedule_id = s.id and e.employee_id = sh.employee_id and e.work_date = sh.work_date
where sh.status <> 'off' and sh.starts_at is not null and sh.break_starts_at is not null
on conflict (entry_id, sequence) do nothing;

insert into public.shift_segments (entry_id, sequence, starts_at, ends_at)
select e.id, 2,
  ((sh.work_date + sh.break_ends_at) at time zone coalesce(st.timezone, 'America/Sao_Paulo')),
  ((sh.work_date + sh.ends_at) at time zone coalesce(st.timezone, 'America/Sao_Paulo'))
from public.shifts sh join public.schedules s on s.legacy_schedule_week_id = sh.schedule_week_id
join public.stores st on st.id = s.store_id
join public.schedule_entries e on e.schedule_id = s.id and e.employee_id = sh.employee_id and e.work_date = sh.work_date
where sh.status <> 'off' and sh.break_ends_at is not null and sh.ends_at is not null
on conflict (entry_id, sequence) do nothing;
