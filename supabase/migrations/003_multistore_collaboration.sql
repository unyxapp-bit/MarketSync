-- Multi-store collaboration: sector scopes, optimistic concurrency and safe publication.

create table if not exists public.member_sectors (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sector_id uuid not null references public.sectors(id) on delete cascade,
  can_edit boolean not null default false,
  primary key (store_id, user_id, sector_id)
);

alter table public.schedule_weeks add column if not exists revision integer not null default 1;

create table if not exists public.schedule_edit_locks (
  schedule_week_id uuid not null references public.schedule_weeks(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  locked_by uuid not null references public.profiles(id) on delete cascade,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 minutes',
  primary key (schedule_week_id, employee_id, work_date)
);

create index if not exists member_sectors_user_store_idx on public.member_sectors (user_id, store_id);
create index if not exists schedule_edit_locks_expiry_idx on public.schedule_edit_locks (expires_at);

-- Only owner and manager have store-wide administrative rights.
create or replace function public.can_manage_store(target_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_memberships
    where store_id = target_store_id and user_id = auth.uid()
      and role in ('owner', 'manager')
  );
$$;

create or replace function public.can_edit_employee(target_employee_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.employees e
    where e.id = target_employee_id
      and (
        public.can_manage_store(e.store_id)
        or exists (
          select 1 from public.member_sectors ms
          where ms.store_id = e.store_id and ms.sector_id = e.sector_id
            and ms.user_id = auth.uid() and ms.can_edit = true
        )
      )
  );
$$;

alter table public.member_sectors enable row level security;
alter table public.schedule_edit_locks enable row level security;
create policy "members can view sector scopes" on public.member_sectors for select using (public.can_access_store(store_id));
create policy "managers can manage sector scopes" on public.member_sectors for all using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy "members can view active locks" on public.schedule_edit_locks for select using (
  exists (select 1 from public.schedule_weeks w where w.id = schedule_week_id and public.can_access_store(w.store_id))
);

create or replace function public.acquire_shift_lock(p_schedule_week_id uuid, p_employee_id uuid, p_work_date date)
returns public.schedule_edit_locks language plpgsql security definer set search_path = public as $$
declare lock_row public.schedule_edit_locks;
begin
  if not public.can_edit_employee(p_employee_id) then raise exception 'Not allowed to edit this employee'; end if;
  delete from public.schedule_edit_locks where expires_at < now();
  insert into public.schedule_edit_locks (schedule_week_id, employee_id, work_date, locked_by, expires_at)
  values (p_schedule_week_id, p_employee_id, p_work_date, auth.uid(), now() + interval '3 minutes')
  on conflict (schedule_week_id, employee_id, work_date) do update
    set locked_by = excluded.locked_by, locked_at = now(), expires_at = excluded.expires_at
    where public.schedule_edit_locks.locked_by = auth.uid() or public.schedule_edit_locks.expires_at < now()
  returning * into lock_row;
  if lock_row is null then raise exception 'This shift is being edited by another user'; end if;
  return lock_row;
end;
$$;

create or replace function public.save_shift_revision(
  p_schedule_week_id uuid, p_employee_id uuid, p_work_date date,
  p_start time, p_break_start time, p_break_end time, p_end time,
  p_status public.shift_status, p_expected_revision integer, p_note text default null
) returns integer language plpgsql security definer set search_path = public as $$
declare current_revision integer;
begin
  select revision into current_revision from public.schedule_weeks where id = p_schedule_week_id for update;
  if current_revision is null then raise exception 'Schedule week not found'; end if;
  if current_revision <> p_expected_revision then raise exception 'CONFLICT: schedule changed by another user'; end if;
  if not public.can_edit_employee(p_employee_id) then raise exception 'Not allowed to edit this employee'; end if;
  if exists (select 1 from public.schedule_weeks where id = p_schedule_week_id and state = 'published') then raise exception 'Published schedules cannot be edited directly'; end if;
  insert into public.shifts (schedule_week_id, employee_id, work_date, starts_at, break_starts_at, break_ends_at, ends_at, status, updated_by, audit_note)
  values (p_schedule_week_id, p_employee_id, p_work_date, p_start, p_break_start, p_break_end, p_end, p_status, auth.uid(), p_note)
  on conflict (employee_id, work_date) do update set
    starts_at = excluded.starts_at, break_starts_at = excluded.break_starts_at, break_ends_at = excluded.break_ends_at,
    ends_at = excluded.ends_at, status = excluded.status, updated_by = excluded.updated_by, audit_note = excluded.audit_note,
    updated_at = now();
  update public.schedule_weeks set revision = revision + 1 where id = p_schedule_week_id returning revision into current_revision;
  insert into public.schedule_audit_events (schedule_week_id, actor_id, event_type, payload)
  values (p_schedule_week_id, auth.uid(), 'updated', jsonb_build_object('employee_id', p_employee_id, 'work_date', p_work_date, 'note', p_note, 'revision', current_revision));
  return current_revision;
end;
$$;

create or replace function public.publish_schedule_week(p_schedule_week_id uuid, p_expected_revision integer)
returns integer language plpgsql security definer set search_path = public as $$
declare current_revision integer; store uuid;
begin
  select revision, store_id into current_revision, store from public.schedule_weeks where id = p_schedule_week_id for update;
  if current_revision is null then raise exception 'Schedule week not found'; end if;
  if not public.can_manage_store(store) then raise exception 'Only a store manager can publish'; end if;
  if current_revision <> p_expected_revision then raise exception 'CONFLICT: schedule changed by another user'; end if;
  update public.schedule_weeks set state = 'published', published_at = now(), published_by = auth.uid(), revision = revision + 1 where id = p_schedule_week_id returning revision into current_revision;
  update public.shifts set status = 'published', updated_at = now() where schedule_week_id = p_schedule_week_id and status = 'draft';
  insert into public.schedule_audit_events (schedule_week_id, actor_id, event_type, payload)
  values (p_schedule_week_id, auth.uid(), 'published', jsonb_build_object('revision', current_revision));
  return current_revision;
end;
$$;

revoke all on function public.acquire_shift_lock(uuid, uuid, date) from public;
revoke all on function public.save_shift_revision(uuid, uuid, date, time, time, time, time, public.shift_status, integer, text) from public;
revoke all on function public.publish_schedule_week(uuid, integer) from public;
grant execute on function public.acquire_shift_lock(uuid, uuid, date) to authenticated;
grant execute on function public.save_shift_revision(uuid, uuid, date, time, time, time, time, public.shift_status, integer, text) to authenticated;
grant execute on function public.publish_schedule_week(uuid, integer) to authenticated;
