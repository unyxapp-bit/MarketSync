-- Transactional canonical edits. Every update checks the displayed revision and resets validation.

create or replace function public.save_canonical_entry(
  p_schedule_id uuid,
  p_employee_id uuid,
  p_work_date date,
  p_day_type public.schedule_day_type,
  p_segments jsonb,
  p_expected_revision integer,
  p_note text default null
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

  insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type, note, revision)
  values (p_schedule_id, p_employee_id, p_work_date, p_day_type, p_note, 1)
  on conflict (schedule_id, employee_id, work_date) do update set
    day_type = excluded.day_type, note = excluded.note, revision = public.schedule_entries.revision + 1, updated_at = now()
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

revoke all on function public.save_canonical_entry(uuid, uuid, date, public.schedule_day_type, jsonb, integer, text) from public;
grant execute on function public.save_canonical_entry(uuid, uuid, date, public.schedule_day_type, jsonb, integer, text) to authenticated;
