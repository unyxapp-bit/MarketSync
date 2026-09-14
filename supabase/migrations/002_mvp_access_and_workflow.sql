-- MVP workflow: self-service onboarding, manager access, audit trail and publishing.

alter table public.schedule_weeks
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists notes text;

alter table public.shifts
  add column if not exists updated_by uuid references public.profiles(id),
  add column if not exists audit_note text;

create table if not exists public.schedule_audit_events (
  id uuid primary key default gen_random_uuid(),
  schedule_week_id uuid not null references public.schedule_weeks(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null check (event_type in ('created', 'updated', 'published', 'unpublished', 'imported')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.can_manage_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_memberships
    where store_id = target_store_id and user_id = auth.uid()
      and role in ('owner', 'manager', 'supervisor')
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.bootstrap_store(organization_name text, store_name text)
returns public.stores language plpgsql security definer set search_path = public as $$
declare
  new_organization public.organizations;
  new_store public.stores;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.organizations (name) values (trim(organization_name)) returning * into new_organization;
  insert into public.stores (organization_id, name) values (new_organization.id, trim(store_name)) returning * into new_store;
  insert into public.store_memberships (store_id, user_id, role) values (new_store.id, auth.uid(), 'owner');
  return new_store;
end;
$$;

create or replace function public.touch_schedule_week()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists touch_schedule_week_on_update on public.schedule_weeks;
create trigger touch_schedule_week_on_update before update on public.schedule_weeks
  for each row execute procedure public.touch_schedule_week();

create policy "users can view their profile" on public.profiles for select using (id = auth.uid());
create policy "users can update their profile" on public.profiles for update using (id = auth.uid());
create policy "members can view memberships" on public.store_memberships for select using (user_id = auth.uid() or public.can_access_store(store_id));
create policy "managers can manage sectors" on public.sectors for all using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy "managers can manage employees" on public.employees for all using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy "managers can manage schedules" on public.schedule_weeks for all using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy "managers can manage shifts" on public.shifts for all using (
  exists (select 1 from public.schedule_weeks w where w.id = schedule_week_id and public.can_manage_store(w.store_id))
) with check (
  exists (select 1 from public.schedule_weeks w where w.id = schedule_week_id and public.can_manage_store(w.store_id))
);
alter table public.schedule_audit_events enable row level security;
create policy "members can view schedule audit" on public.schedule_audit_events for select using (
  exists (select 1 from public.schedule_weeks w where w.id = schedule_week_id and public.can_access_store(w.store_id))
);
create policy "managers can create schedule audit" on public.schedule_audit_events for insert with check (
  exists (select 1 from public.schedule_weeks w where w.id = schedule_week_id and public.can_manage_store(w.store_id))
);
