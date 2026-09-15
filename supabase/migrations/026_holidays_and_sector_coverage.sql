-- Adds what the last two spec rule types need that the schema didn't have:
--   HOLIDAY_AUTHORIZATION needs a holiday calendar and a way to mark a work day as authorized.
--   SECTOR_COVERAGE needs nothing new in schema — its parameters are just {sectorName: minimum},
--   which the existing generic Regras editor already renders fine.

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, date)
);

alter table public.holidays enable row level security;
create policy "members view holidays" on public.holidays for select using (public.can_access_organization(organization_id));

create or replace function public.add_holiday(p_organization_id uuid, p_date date, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not exists (
    select 1 from public.store_memberships m join public.stores s on s.id = m.store_id
    where m.user_id = auth.uid() and m.role in ('owner', 'rh') and s.organization_id = p_organization_id
  ) then raise exception 'Only an organization owner or RH/DP can manage the holiday calendar'; end if;
  insert into public.holidays (organization_id, date, name) values (p_organization_id, p_date, trim(p_name))
  on conflict (organization_id, date) do update set name = excluded.name
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.add_holiday(uuid, date, text) from anon, public;
grant execute on function public.add_holiday(uuid, date, text) to authenticated;

create or replace function public.delete_holiday(p_holiday_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare h public.holidays;
begin
  select * into h from public.holidays where id = p_holiday_id;
  if h.id is null then raise exception 'Holiday not found'; end if;
  if not exists (
    select 1 from public.store_memberships m join public.stores s on s.id = m.store_id
    where m.user_id = auth.uid() and m.role in ('owner', 'rh') and s.organization_id = h.organization_id
  ) then raise exception 'Only an organization owner or RH/DP can manage the holiday calendar'; end if;
  delete from public.holidays where id = p_holiday_id;
end;
$$;
revoke execute on function public.delete_holiday(uuid) from anon, public;
grant execute on function public.delete_holiday(uuid) to authenticated;

-- A manager can flag a specific work day as an authorized holiday shift instead of leaving it as
-- an unresolved violation forever.
alter table public.schedule_entries add column if not exists holiday_authorized boolean not null default false;

create or replace function public.save_canonical_entry(
  p_schedule_id uuid,
  p_employee_id uuid,
  p_work_date date,
  p_day_type public.schedule_day_type,
  p_segments jsonb,
  p_expected_revision integer,
  p_note text default null,
  p_holiday_authorized boolean default false
) returns integer language plpgsql security definer set search_path = public as $$
declare
  schedule_row public.schedules;
  current_entry_id uuid;
  next_revision integer;
  segment_record record;
  position smallint := 0;
begin
  select * into schedule_row from public.schedules where id = p_schedule_id for update;
  if schedule_row.id is null then raise exception 'Schedule not found'; end if;
  if schedule_row.revision <> p_expected_revision then raise exception 'CONFLICT: schedule changed by another user'; end if;
  if schedule_row.status = 'published' then raise exception 'Published schedules cannot be edited; create a new revision first'; end if;
  if not public.can_edit_employee(p_employee_id) then raise exception 'Not allowed to edit this employee'; end if;
  if p_day_type = 'work' and jsonb_array_length(coalesce(p_segments, '[]'::jsonb)) = 0 then raise exception 'A work day needs at least one period'; end if;

  insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type, note, revision, holiday_authorized)
  values (p_schedule_id, p_employee_id, p_work_date, p_day_type, p_note, 1, p_holiday_authorized)
  on conflict (schedule_id, employee_id, work_date) do update set
    day_type = excluded.day_type, note = excluded.note, revision = public.schedule_entries.revision + 1,
    holiday_authorized = excluded.holiday_authorized, updated_at = now()
  returning id into current_entry_id;
  delete from public.shift_segments where entry_id = current_entry_id;
  if p_day_type = 'work' then
    for segment_record in
      select value from jsonb_array_elements(p_segments) order by (value ->> 'startsAt')
    loop
      position := position + 1;
      if coalesce(segment_record.value ->> 'startsAt', '') = '' or coalesce(segment_record.value ->> 'endsAt', '') = '' then
        raise exception 'Each period needs a start and end time';
      end if;
      insert into public.shift_segments (entry_id, sequence, starts_at, ends_at)
      values (current_entry_id, position, (segment_record.value ->> 'startsAt')::timestamptz, (segment_record.value ->> 'endsAt')::timestamptz);
    end loop;
  end if;
  update public.schedules set revision = revision + 1, status = 'draft', updated_at = now()
  where id = p_schedule_id returning revision into next_revision;
  insert into public.audit_logs (organization_id, store_id, actor_id, action, entity_type, entity_id, payload)
  select st.organization_id, schedule_row.store_id, auth.uid(), 'entry_updated', 'schedule_entry', current_entry_id,
    jsonb_build_object('scheduleId', p_schedule_id, 'employeeId', p_employee_id, 'workDate', p_work_date, 'revision', next_revision)
  from public.stores st where st.id = schedule_row.store_id;
  return next_revision;
end;
$$;

revoke execute on function public.save_canonical_entry(uuid, uuid, date, public.schedule_day_type, jsonb, integer, text, boolean) from anon, public;
grant execute on function public.save_canonical_entry(uuid, uuid, date, public.schedule_day_type, jsonb, integer, text, boolean) to authenticated;

-- The old 6-arg overload no longer matches any client call; drop it so PostgREST doesn't expose
-- two versions of the same RPC name with different signatures.
drop function if exists public.save_canonical_entry(uuid, uuid, date, public.schedule_day_type, jsonb, integer, text);
