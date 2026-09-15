-- Fix: canonical schedules never had rule_set_id populated outside of the one-time backfill in
-- migration 010, so every schedule created afterwards (via sync_legacy_week_to_canonical, the
-- only real creation path today) silently validated against the hardcoded fallback rule
-- parameters in validate-schedule instead of the organization's versioned rule set.

create or replace function public.active_rule_set_for_store(p_store_id uuid, p_week_start date)
returns uuid language sql stable security definer set search_path = public as $$
  select rs.id
  from public.rule_sets rs
  join public.stores st on st.organization_id = rs.organization_id
  where st.id = p_store_id
    and rs.effective_from <= p_week_start
    and (rs.effective_to is null or rs.effective_to >= p_week_start)
  order by rs.effective_from desc, rs.version desc
  limit 1;
$$;

revoke execute on function public.active_rule_set_for_store(uuid, date) from anon;

create or replace function public.sync_legacy_week_to_canonical(p_legacy_week_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare canonical_id uuid; legacy_row public.schedule_weeks; active_rule_set uuid;
begin
  select * into legacy_row from public.schedule_weeks where id = p_legacy_week_id;
  if legacy_row.id is null then raise exception 'Legacy schedule week not found'; end if;
  if not public.can_manage_store(legacy_row.store_id) then raise exception 'Not allowed to synchronize this store'; end if;
  active_rule_set := public.active_rule_set_for_store(legacy_row.store_id, legacy_row.week_start);
  select id into canonical_id from public.schedules where legacy_schedule_week_id = p_legacy_week_id;
  if canonical_id is null then
    insert into public.schedules (store_id, week_start, status, revision, rule_set_id, legacy_schedule_week_id, created_by)
    values (legacy_row.store_id, legacy_row.week_start, case when legacy_row.state = 'published' then 'published'::public.schedule_status else 'draft'::public.schedule_status end, legacy_row.revision, active_rule_set, legacy_row.id, auth.uid())
    returning id into canonical_id;
  else
    update public.schedules set rule_set_id = coalesce(rule_set_id, active_rule_set) where id = canonical_id;
  end if;
  delete from public.shift_segments where entry_id in (select id from public.schedule_entries where schedule_id = canonical_id);
  delete from public.schedule_entries where schedule_id = canonical_id;
  insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
  select canonical_id, sh.employee_id, sh.work_date, case when sh.status = 'off' then 'off'::public.schedule_day_type else 'work'::public.schedule_day_type end
  from public.shifts sh where sh.schedule_week_id = p_legacy_week_id;
  insert into public.shift_segments (entry_id, sequence, starts_at, ends_at)
  select e.id, 1, ((sh.work_date + sh.starts_at) at time zone coalesce(st.timezone, 'America/Sao_Paulo')), ((sh.work_date + sh.break_starts_at) at time zone coalesce(st.timezone, 'America/Sao_Paulo'))
  from public.shifts sh join public.stores st on st.id = legacy_row.store_id join public.schedule_entries e on e.schedule_id = canonical_id and e.employee_id = sh.employee_id and e.work_date = sh.work_date
  where sh.schedule_week_id = p_legacy_week_id and sh.status <> 'off' and sh.starts_at is not null and sh.break_starts_at is not null;
  insert into public.shift_segments (entry_id, sequence, starts_at, ends_at)
  select e.id, 2, ((sh.work_date + sh.break_ends_at) at time zone coalesce(st.timezone, 'America/Sao_Paulo')), ((sh.work_date + sh.ends_at) at time zone coalesce(st.timezone, 'America/Sao_Paulo'))
  from public.shifts sh join public.stores st on st.id = legacy_row.store_id join public.schedule_entries e on e.schedule_id = canonical_id and e.employee_id = sh.employee_id and e.work_date = sh.work_date
  where sh.schedule_week_id = p_legacy_week_id and sh.status <> 'off' and sh.break_ends_at is not null and sh.ends_at is not null;
  update public.schedules set revision = legacy_row.revision, updated_at = now(), status = case when legacy_row.state = 'published' then 'published'::public.schedule_status else 'draft'::public.schedule_status end where id = canonical_id;
  return canonical_id;
end;
$$;

revoke execute on function public.sync_legacy_week_to_canonical(uuid) from anon;
grant execute on function public.sync_legacy_week_to_canonical(uuid) to authenticated;

-- Backfill schedules created since migration 010 that never got a rule_set_id.
update public.schedules s
set rule_set_id = public.active_rule_set_for_store(s.store_id, s.week_start)
where s.rule_set_id is null;
