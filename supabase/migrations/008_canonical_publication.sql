-- Canonical publication: publish only a validated revision and preserve its immutable snapshot.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_logs_store_occurred_idx on public.audit_logs(store_id, occurred_at desc);
alter table public.audit_logs enable row level security;
create policy "members view store audit logs" on public.audit_logs for select using (public.can_access_store(store_id));

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
  if schedule_row.status <> 'ready' then raise exception 'Schedule must pass validation before publication'; end if;
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

revoke all on function public.publish_canonical_schedule(uuid, integer, uuid) from public;
grant execute on function public.publish_canonical_schedule(uuid, integer, uuid) to authenticated;
