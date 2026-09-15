-- Extends the default rule set with the newly implemented rule types (intraday break, daily and
-- weekly minutes, employee unavailability) as a new version, so the previous one stays in the
-- audit trail per "editing creates a version, not an overwrite." This mirrors
-- create_rule_set_revision, but runs as plain SQL because a migration has no authenticated owner
-- session for that RPC's auth.uid() check to pass.
--
-- All four are seeded as non-blocking warnings: they are new checks nobody has configured yet,
-- so they should surface as advisories rather than suddenly blocking an existing publish flow.
-- An organization owner can raise their severity from the Regras screen once reviewed.

do $$
declare
  v1 record;
  v2_id uuid;
begin
  for v1 in
    select * from public.rule_sets where name = 'Padrão operacional MarketSync' and effective_to is null
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
