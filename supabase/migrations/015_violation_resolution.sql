-- Lets a manager accept a non-blocking alert (severity info/warning, blocking = false) with a
-- justification, as required by the Central de conflitos screen. Blocking violations are never
-- acceptable this way; they must be fixed in the schedule and re-validated.

create or replace function public.resolve_violation(p_violation_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.violations;
begin
  select * into v from public.violations where id = p_violation_id;
  if v.id is null then raise exception 'Violation not found'; end if;
  if v.blocking then raise exception 'Blocking violations cannot be accepted; fix the schedule instead'; end if;
  if not exists (
    select 1 from public.validation_runs vr join public.schedules s on s.id = vr.schedule_id
    where vr.id = v.validation_run_id and public.can_manage_store(s.store_id)
  ) then raise exception 'Not allowed to resolve this violation'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'A justification is required'; end if;
  update public.violations
  set resolved_at = now(), resolved_by = auth.uid(), resolution_note = p_note
  where id = p_violation_id;
end;
$$;

revoke execute on function public.resolve_violation(uuid, text) from anon;
grant execute on function public.resolve_violation(uuid, text) to authenticated;
