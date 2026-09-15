-- Closes a real gap from the spec: publish_canonical_schedule went straight from a passed
-- validation to 'published', skipping the mandatory 'pending_approval' -> 'approved' states
-- the schedule_status enum already had, and the approvals table was never written to.

-- approvals was modeled to reference an immutable schedule_version, but a version snapshot is
-- only created at publish time today. Approval has to happen before that snapshot exists, so we
-- let an approval reference the schedule + the validation run it approved instead.
alter table public.approvals alter column schedule_version_id drop not null;
alter table public.approvals add column if not exists schedule_id uuid references public.schedules(id) on delete cascade;
alter table public.approvals add column if not exists validation_run_id uuid references public.validation_runs(id);
alter table public.approvals add constraint approvals_target_check check (schedule_version_id is not null or schedule_id is not null);

create index if not exists approvals_schedule_id_idx on public.approvals (schedule_id);

create or replace function public.submit_schedule_for_approval(p_schedule_id uuid, p_expected_revision integer)
returns integer language plpgsql security definer set search_path = public as $$
declare schedule_row public.schedules;
begin
  select * into schedule_row from public.schedules where id = p_schedule_id for update;
  if schedule_row.id is null then raise exception 'Schedule not found'; end if;
  if not public.can_manage_store(schedule_row.store_id) then raise exception 'Only a store manager can submit for approval'; end if;
  if schedule_row.revision <> p_expected_revision then raise exception 'CONFLICT: schedule changed by another user'; end if;
  if schedule_row.status <> 'ready' then raise exception 'Schedule must pass validation before submitting for approval'; end if;
  update public.schedules set status = 'pending_approval', updated_at = now() where id = p_schedule_id;
  insert into public.audit_logs (organization_id, store_id, actor_id, action, entity_type, entity_id, payload)
  select st.organization_id, schedule_row.store_id, auth.uid(), 'submitted_for_approval', 'schedule', schedule_row.id, jsonb_build_object('revision', schedule_row.revision)
  from public.stores st where st.id = schedule_row.store_id;
  return schedule_row.revision;
end;
$$;
revoke execute on function public.submit_schedule_for_approval(uuid, integer) from anon;
grant execute on function public.submit_schedule_for_approval(uuid, integer) to authenticated;

create or replace function public.decide_schedule_approval(p_schedule_id uuid, p_expected_revision integer, p_decision text, p_reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare schedule_row public.schedules; run_id uuid;
begin
  if p_decision not in ('approved', 'rejected') then raise exception 'Invalid decision'; end if;
  select * into schedule_row from public.schedules where id = p_schedule_id for update;
  if schedule_row.id is null then raise exception 'Schedule not found'; end if;
  if not public.can_manage_store(schedule_row.store_id) then raise exception 'Only a store manager can approve'; end if;
  if schedule_row.revision <> p_expected_revision then raise exception 'CONFLICT: schedule changed by another user'; end if;
  if schedule_row.status <> 'pending_approval' then raise exception 'Schedule is not awaiting approval'; end if;
  if p_decision = 'rejected' and coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required to reject'; end if;
  select id into run_id from public.validation_runs
  where schedule_id = p_schedule_id and schedule_revision = p_expected_revision and status = 'passed'
  order by completed_at desc limit 1;
  insert into public.approvals (schedule_id, validation_run_id, approver_id, decision, reason)
  values (p_schedule_id, run_id, auth.uid(), p_decision, p_reason);
  update public.schedules
  set status = case when p_decision = 'approved' then 'approved'::public.schedule_status else 'draft'::public.schedule_status end,
      updated_at = now()
  where id = p_schedule_id;
  insert into public.audit_logs (organization_id, store_id, actor_id, action, entity_type, entity_id, payload)
  select st.organization_id, schedule_row.store_id, auth.uid(), 'approval_decided', 'schedule', schedule_row.id, jsonb_build_object('decision', p_decision, 'reason', p_reason)
  from public.stores st where st.id = schedule_row.store_id;
  return schedule_row.revision;
end;
$$;
revoke execute on function public.decide_schedule_approval(uuid, integer, text, text) from anon;
grant execute on function public.decide_schedule_approval(uuid, integer, text, text) to authenticated;

-- Publication now requires the explicit approval step instead of jumping straight from 'ready'.
create or replace function public.publish_canonical_schedule(
  p_schedule_id uuid,
  p_expected_revision integer,
  p_idempotency_key uuid default gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  schedule_row public.schedules;
  existing_publication public.publications;
  snapshot_value jsonb;
  snapshot_checksum text;
  version_number integer;
  version_id uuid;
  publication_id uuid;
  published_revision integer;
begin
  select p.* into existing_publication
  from public.publications p
  where p.idempotency_key = p_idempotency_key;
  if existing_publication.id is not null then
    select revision into published_revision
    from public.schedules s join public.schedule_versions v on v.schedule_id = s.id
    where v.id = existing_publication.schedule_version_id;
    return jsonb_build_object('revision', published_revision, 'publicationId', existing_publication.id, 'idempotent', true);
  end if;

  select * into schedule_row from public.schedules where id = p_schedule_id for update;
  if schedule_row.id is null then raise exception 'Schedule not found'; end if;
  if not public.can_manage_store(schedule_row.store_id) then raise exception 'Only a store owner or manager can publish'; end if;
  if schedule_row.revision <> p_expected_revision then raise exception 'CONFLICT: schedule changed by another user'; end if;
  if schedule_row.status <> 'approved' then raise exception 'Schedule must be approved before publication'; end if;
  if not exists (
    select 1 from public.validation_runs vr
    where vr.schedule_id = schedule_row.id
      and vr.schedule_revision = schedule_row.revision
      and vr.status = 'passed'
  ) then raise exception 'A passed validation for this revision is required'; end if;

  select jsonb_build_object(
    'scheduleId', schedule_row.id,
    'storeId', schedule_row.store_id,
    'weekStart', schedule_row.week_start,
    'revision', schedule_row.revision,
    'entries', coalesce(jsonb_agg(jsonb_build_object(
      'entryId', e.id,
      'employeeId', e.employee_id,
      'workDate', e.work_date,
      'dayType', e.day_type,
      'note', e.note,
      'segments', coalesce((select jsonb_agg(jsonb_build_object('sequence', sg.sequence, 'startsAt', sg.starts_at, 'endsAt', sg.ends_at) order by sg.sequence) from public.shift_segments sg where sg.entry_id = e.id), '[]'::jsonb)
    ) order by e.work_date, e.employee_id), '[]'::jsonb)
  ) into snapshot_value
  from public.schedule_entries e where e.schedule_id = schedule_row.id;

  snapshot_checksum := encode(digest(snapshot_value::text, 'sha256'), 'hex');
  select coalesce(max(number), 0) + 1 into version_number from public.schedule_versions where schedule_id = schedule_row.id;
  insert into public.schedule_versions (schedule_id, number, snapshot, checksum, created_by)
  values (schedule_row.id, version_number, snapshot_value, snapshot_checksum, auth.uid()) returning id into version_id;
  insert into public.publications (schedule_version_id, published_by, idempotency_key)
  values (version_id, auth.uid(), p_idempotency_key) returning id into publication_id;
  update public.schedules set status = 'published', revision = revision + 1, updated_at = now()
  where id = schedule_row.id returning revision into published_revision;
  insert into public.audit_logs (organization_id, store_id, actor_id, action, entity_type, entity_id, payload)
  select st.organization_id, schedule_row.store_id, auth.uid(), 'published', 'schedule', schedule_row.id,
    jsonb_build_object('versionId', version_id, 'version', version_number, 'publishedRevision', published_revision)
  from public.stores st where st.id = schedule_row.store_id;
  return jsonb_build_object('revision', published_revision, 'versionId', version_id, 'publicationId', publication_id, 'idempotent', false);
end;
$$;

revoke execute on function public.publish_canonical_schedule(uuid, integer, uuid) from anon;
grant execute on function public.publish_canonical_schedule(uuid, integer, uuid) to authenticated;
