-- MarketSync MVP schema. Run in Supabase SQL Editor before connecting the app.
create extension if not exists pgcrypto;

create type public.member_role as enum ('owner', 'manager', 'supervisor', 'employee');
create type public.shift_status as enum ('draft', 'published', 'off', 'leave');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  city text,
  state char(2),
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table public.store_memberships (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'employee',
  primary key (store_id, user_id)
);

create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  color text not null default '#167B62',
  unique (store_id, name)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  sector_id uuid references public.sectors(id) on delete set null,
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  job_title text not null,
  active boolean not null default true,
  weekly_hours numeric(5,2) not null default 44,
  created_at timestamptz not null default now()
);

create table public.schedule_weeks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  week_start date not null,
  state public.shift_status not null default 'draft' check (state in ('draft', 'published')),
  published_at timestamptz,
  published_by uuid references public.profiles(id),
  unique (store_id, week_start)
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  schedule_week_id uuid not null references public.schedule_weeks(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  starts_at time,
  break_starts_at time,
  break_ends_at time,
  ends_at time,
  status public.shift_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date),
  check (
    (status in ('off', 'leave') and starts_at is null and ends_at is null)
    or (status in ('draft', 'published') and starts_at is not null and ends_at is not null)
  )
);

create index shifts_employee_date_idx on public.shifts (employee_id, work_date);

-- All application access is restricted to users assigned to the same store.
alter table public.organizations enable row level security;
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.store_memberships enable row level security;
alter table public.sectors enable row level security;
alter table public.employees enable row level security;
alter table public.schedule_weeks enable row level security;
alter table public.shifts enable row level security;

create or replace function public.can_access_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_memberships
    where store_id = target_store_id and user_id = auth.uid()
  );
$$;

create policy "members can view stores" on public.stores for select using (public.can_access_store(id));
create policy "members can view sectors" on public.sectors for select using (public.can_access_store(store_id));
create policy "members can view employees" on public.employees for select using (public.can_access_store(store_id));
create policy "members can view schedules" on public.schedule_weeks for select using (public.can_access_store(store_id));
create policy "members can view shifts" on public.shifts for select using (
  exists (select 1 from public.schedule_weeks w where w.id = schedule_week_id and public.can_access_store(w.store_id))
);

-- Add manager-only write policies after the management workflow is finalized.
