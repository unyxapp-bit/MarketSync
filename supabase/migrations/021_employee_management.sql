-- There was no way to actually register an employee through the app before this: `employees`
-- had no insert/update policy or RPC (only the one-time importReceivedWeek seed and raw SQL
-- ever wrote to it), and the spec's "Colaboradores" screen needs registration/matrícula and a
-- real status (ativo/afastado/desligado), not just the boolean `active` flag.

create type public.employee_status as enum ('active', 'leave', 'terminated');

alter table public.employees add column if not exists registration text;
alter table public.employees add column if not exists status public.employee_status not null default 'active';
alter table public.employees add constraint employees_store_registration_unique unique (store_id, registration);

create or replace function public.upsert_employee(
  p_employee_id uuid,
  p_store_id uuid,
  p_sector_id uuid,
  p_full_name text,
  p_job_title text,
  p_registration text,
  p_weekly_hours numeric,
  p_status public.employee_status
) returns uuid language plpgsql security definer set search_path = public as $$
declare result_id uuid;
begin
  if not public.can_manage_store(p_store_id) then raise exception 'Only a store manager can manage employees'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Name is required'; end if;
  if p_employee_id is null then
    insert into public.employees (store_id, sector_id, full_name, job_title, registration, weekly_hours, status, active)
    values (p_store_id, p_sector_id, trim(p_full_name), trim(p_job_title), nullif(trim(p_registration), ''), p_weekly_hours, p_status, p_status <> 'terminated')
    returning id into result_id;
  else
    update public.employees set
      sector_id = p_sector_id,
      full_name = trim(p_full_name),
      job_title = trim(p_job_title),
      registration = nullif(trim(p_registration), ''),
      weekly_hours = p_weekly_hours,
      status = p_status,
      active = (p_status <> 'terminated')
    where id = p_employee_id and store_id = p_store_id
    returning id into result_id;
    if result_id is null then raise exception 'Employee not found'; end if;
  end if;
  return result_id;
end;
$$;
revoke execute on function public.upsert_employee(uuid, uuid, uuid, text, text, text, numeric, public.employee_status) from anon, public;
grant execute on function public.upsert_employee(uuid, uuid, uuid, text, text, text, numeric, public.employee_status) to authenticated;

-- A contract change is a new vigência, not an edit of the past one: close the currently open
-- contract the day before the new one starts and insert a fresh row, mirroring how rule set
-- revisions work.
create or replace function public.add_employment_contract(
  p_employee_id uuid,
  p_start_date date,
  p_weekly_minutes integer,
  p_rule_set_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid; emp public.employees;
begin
  select * into emp from public.employees where id = p_employee_id;
  if emp.id is null then raise exception 'Employee not found'; end if;
  if not public.can_manage_store(emp.store_id) then raise exception 'Only a store manager can manage contracts'; end if;
  update public.employment_contracts set end_date = p_start_date - 1
  where employee_id = p_employee_id and end_date is null and start_date < p_start_date;
  insert into public.employment_contracts (employee_id, start_date, weekly_minutes, rule_set_id)
  values (p_employee_id, p_start_date, p_weekly_minutes, p_rule_set_id)
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.add_employment_contract(uuid, date, integer, uuid) from anon, public;
grant execute on function public.add_employment_contract(uuid, date, integer, uuid) to authenticated;

create or replace function public.add_employee_constraint(
  p_employee_id uuid,
  p_type text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid; emp public.employees;
begin
  select * into emp from public.employees where id = p_employee_id;
  if emp.id is null then raise exception 'Employee not found'; end if;
  if not public.can_manage_store(emp.store_id) then raise exception 'Only a store manager can manage constraints'; end if;
  insert into public.employee_constraints (employee_id, type, start_at, end_at, payload)
  values (p_employee_id, p_type, p_start_at, p_end_at, coalesce(p_payload, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.add_employee_constraint(uuid, text, timestamptz, timestamptz, jsonb) from anon, public;
grant execute on function public.add_employee_constraint(uuid, text, timestamptz, timestamptz, jsonb) to authenticated;

create or replace function public.delete_employee_constraint(p_constraint_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare c public.employee_constraints; emp public.employees;
begin
  select * into c from public.employee_constraints where id = p_constraint_id;
  if c.id is null then raise exception 'Constraint not found'; end if;
  select * into emp from public.employees where id = c.employee_id;
  if not public.can_manage_store(emp.store_id) then raise exception 'Only a store manager can manage constraints'; end if;
  delete from public.employee_constraints where id = p_constraint_id;
end;
$$;
revoke execute on function public.delete_employee_constraint(uuid) from anon, public;
grant execute on function public.delete_employee_constraint(uuid) to authenticated;
