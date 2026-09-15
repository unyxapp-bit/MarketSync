-- CLT art. 386 requires a fortnightly rotation for women specifically: two consecutive worked
-- Sundays are never allowed for a female employee, even when the general SUNDAY_REST_ROTATION
-- window (max N of the last `window_weeks` Sundays) would otherwise still permit it. Needs to
-- know each employee's sex, which the schema didn't track; the field is optional (nullable) since
-- not every employee will have it filled in right away, and the rule simply can't fire for
-- employees it isn't set on.

alter table public.employees add column if not exists sex text check (sex in ('male', 'female'));

create or replace function public.upsert_employee(
  p_employee_id uuid,
  p_store_id uuid,
  p_sector_id uuid,
  p_full_name text,
  p_job_title text,
  p_registration text,
  p_weekly_hours numeric,
  p_status public.employee_status,
  p_sex text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare result_id uuid;
begin
  if not public.can_manage_store(p_store_id) then raise exception 'Only a store manager can manage employees'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Name is required'; end if;
  if p_sex is not null and p_sex not in ('male', 'female') then raise exception 'Invalid sex value'; end if;
  if p_employee_id is null then
    insert into public.employees (store_id, sector_id, full_name, job_title, registration, weekly_hours, status, active, sex)
    values (p_store_id, p_sector_id, trim(p_full_name), trim(p_job_title), nullif(trim(p_registration), ''), p_weekly_hours, p_status, p_status <> 'terminated', p_sex)
    returning id into result_id;
  else
    update public.employees set
      sector_id = p_sector_id,
      full_name = trim(p_full_name),
      job_title = trim(p_job_title),
      registration = nullif(trim(p_registration), ''),
      weekly_hours = p_weekly_hours,
      status = p_status,
      active = (p_status <> 'terminated'),
      sex = p_sex
    where id = p_employee_id and store_id = p_store_id
    returning id into result_id;
    if result_id is null then raise exception 'Employee not found'; end if;
  end if;
  return result_id;
end;
$$;

revoke execute on function public.upsert_employee(uuid, uuid, uuid, text, text, text, numeric, public.employee_status, text) from anon, public;
grant execute on function public.upsert_employee(uuid, uuid, uuid, text, text, text, numeric, public.employee_status, text) to authenticated;

-- The old 8-arg overload no longer matches any client call; drop it so PostgREST doesn't expose
-- two versions of the same RPC name with different signatures.
drop function if exists public.upsert_employee(uuid, uuid, uuid, text, text, text, numeric, public.employee_status);

-- Seed the new rule into every organization's active rule set as a new revision, following the
-- same pattern as migrations 023/027. Starts as a non-blocking warning (like the other rules that
-- haven't been reviewed by RH yet) since its legal basis (whether art. 386 still applies given how
-- much of CLT's women-specific chapter was revoked in 2017) is worth a human confirming, and
-- because it can only ever fire once someone actually fills in the sex field.
do $$
declare
  v1 record;
  v2_id uuid;
begin
  for v1 in
    select * from public.rule_sets where effective_to is null
  loop
    update public.rule_sets set effective_to = current_date - 1 where id = v1.id;

    insert into public.rule_sets (organization_id, name, version, effective_from, approved_by)
    values (v1.organization_id, v1.name, v1.version + 1, current_date, null)
    returning id into v2_id;

    insert into public.rules (rule_set_id, code, severity, blocking, parameters, scope, legal_basis)
    select v2_id, r.code, r.severity, r.blocking, r.parameters, r.scope, r.legal_basis
    from public.rules r where r.rule_set_id = v1.id;

    insert into public.rules (rule_set_id, code, severity, blocking, parameters, scope, legal_basis)
    values
      (v2_id, 'SUNDAY_REST_ROTATION_WOMEN', 'warning', false, '{}'::jsonb, '{}'::jsonb,
        'CLT, art. 386 (revezamento quinzenal para mulheres) — confirmar vigência conforme convenção coletiva aplicável');

    update public.schedules set rule_set_id = v2_id
    where rule_set_id = v1.id and status <> 'published';
  end loop;
end $$;
