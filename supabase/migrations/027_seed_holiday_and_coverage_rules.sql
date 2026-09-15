-- Adds the last two rule types (SECTOR_COVERAGE, HOLIDAY_AUTHORIZATION) to every organization's
-- active rule set, following the same new-revision pattern as migration 023. Both start as
-- non-blocking warnings: HOLIDAY_AUTHORIZATION needs holidays to actually be registered first
-- (Regras > Calendário de feriados) and SECTOR_COVERAGE starts with every sector's minimum at 0
-- (a no-op) so RH can dial in real staffing minimums per sector without an immediate flood of
-- warnings on days that were never meant to be fully staffed.

do $$
declare
  v1 record;
  v2_id uuid;
  coverage_params jsonb;
begin
  for v1 in
    select * from public.rule_sets where effective_to is null
  loop
    select coalesce(jsonb_object_agg(distinct s.name, 0), '{}'::jsonb) into coverage_params
    from public.sectors s
    join public.stores st on st.id = s.store_id
    where st.organization_id = v1.organization_id;

    update public.rule_sets set effective_to = current_date - 1 where id = v1.id;

    insert into public.rule_sets (organization_id, name, version, effective_from, approved_by)
    values (v1.organization_id, v1.name, v1.version + 1, current_date, null)
    returning id into v2_id;

    insert into public.rules (rule_set_id, code, severity, blocking, parameters, scope, legal_basis)
    select v2_id, r.code, r.severity, r.blocking, r.parameters, r.scope, r.legal_basis
    from public.rules r where r.rule_set_id = v1.id;

    insert into public.rules (rule_set_id, code, severity, blocking, parameters, scope, legal_basis)
    values
      (v2_id, 'SECTOR_COVERAGE', 'warning', false, coverage_params, '{}'::jsonb,
        'Necessidade operacional da loja'),
      (v2_id, 'HOLIDAY_AUTHORIZATION', 'warning', false, '{}'::jsonb, '{}'::jsonb,
        'CLT, art. 70; convenção coletiva aplicável');

    update public.schedules set rule_set_id = v2_id
    where rule_set_id = v1.id and status <> 'published';
  end loop;
end $$;
