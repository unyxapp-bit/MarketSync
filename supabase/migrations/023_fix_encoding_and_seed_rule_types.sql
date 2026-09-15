-- Migration 022 tried to match the rule_set by name and matched zero rows: migration 010's
-- original apply left rule_sets.name and rules.legal_basis double UTF-8 encoded (each non-ASCII
-- character was encoded to UTF-8 once, then those bytes were mis-read as Latin-1 and encoded
-- again), so 022's correctly-typed literal never matched the corrupted stored value. Confirmed
-- narrow in scope: employees.full_name and other text columns are correctly encoded; only the
-- two migration-010 columns are affected.

update public.rule_sets
set name = 'Padrão operacional MarketSync'
where id = '392c30aa-8325-411c-80c6-f97610a8c2c2';

update public.rules
set legal_basis = 'Lei 10.101/2000, art. 6º, parágrafo único; sujeito à norma coletiva aplicável'
where code = 'SUNDAY_REST_ROTATION'
  and rule_set_id = '392c30aa-8325-411c-80c6-f97610a8c2c2';

-- Now do what 022 intended: a new rule set version carrying the four newly implemented rule
-- types (intraday break, daily/weekly minutes, employee unavailability), non-blocking warnings
-- since nobody has reviewed them yet.
do $$
declare
  v1 record;
  v2_id uuid;
begin
  for v1 in
    select * from public.rule_sets where id = '392c30aa-8325-411c-80c6-f97610a8c2c2' and effective_to is null
  loop
    update public.rule_sets set effective_to = current_date - 1 where id = v1.id;

    insert into public.rule_sets (organization_id, name, version, effective_from, approved_by)
    values (v1.organization_id, 'Padrão operacional MarketSync', v1.version + 1, current_date, null)
    returning id into v2_id;

    insert into public.rules (rule_set_id, code, severity, blocking, parameters, scope, legal_basis)
    select v2_id, r.code, r.severity, r.blocking, r.parameters, r.scope, r.legal_basis
    from public.rules r where r.rule_set_id = v1.id;

    insert into public.rules (rule_set_id, code, severity, blocking, parameters, scope, legal_basis)
    values
      (v2_id, 'INTRADAY_BREAK', 'warning', false,
        '{"threshold_over_hours":6,"threshold_partial_hours":4,"minimum_break_over_minutes":60,"minimum_break_partial_minutes":15}'::jsonb,
        '{}'::jsonb, 'CLT, art. 71'),
      (v2_id, 'DAILY_MINUTES', 'warning', false,
        '{"maximum_minutes":600}'::jsonb, '{}'::jsonb, 'CLT, art. 59'),
      (v2_id, 'WEEKLY_MINUTES', 'warning', false,
        '{"tolerance_minutes":0,"default_weekly_minutes":2640}'::jsonb, '{}'::jsonb, 'Contrato de trabalho'),
      (v2_id, 'EMPLOYEE_UNAVAILABLE', 'warning', false,
        '{}'::jsonb, '{}'::jsonb, 'Restrição de disponibilidade cadastrada');

    update public.schedules set rule_set_id = v2_id
    where rule_set_id = v1.id and status <> 'published';
  end loop;
end $$;
