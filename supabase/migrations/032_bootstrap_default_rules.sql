-- bootstrap_store never created a rule_set for a brand-new organization — migration 010 seeded
-- the 5 core CLT rules once, as a backfill for orgs that already existed at the time, but nothing
-- has seeded new signups since. The 5 blocking rules still applied via validate-schedule's
-- hardcoded fallbacks (map.get(code) ?? fallback), but every opt-in rule added since
-- (INTRADAY_BREAK, DAILY_MINUTES, WEEKLY_MINUTES, EMPLOYEE_UNAVAILABLE, SECTOR_COVERAGE,
-- HOLIDAY_AUTHORIZATION, SUNDAY_REST_ROTATION_WOMEN) has no fallback and silently never fires for
-- a new store, and Regras shows "Nenhum perfil de regras cadastrado" with no way to create one
-- from scratch. Every new store now starts with the same 12-rule baseline the pilot organization
-- currently runs, non-blocking for the rules that still need a human to review them.

create or replace function public.bootstrap_store(organization_name text, store_name text)
returns public.stores language plpgsql security definer set search_path = public as $$
declare
  new_organization public.organizations;
  new_store public.stores;
  new_rule_set_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.organizations (name) values (trim(organization_name)) returning * into new_organization;
  insert into public.stores (organization_id, name) values (new_organization.id, trim(store_name)) returning * into new_store;
  insert into public.store_memberships (store_id, user_id, role) values (new_store.id, auth.uid(), 'owner');

  insert into public.rule_sets (organization_id, store_id, name, version, effective_from, approved_by)
  values (new_organization.id, new_store.id, 'Padrão operacional MarketSync', 1, current_date, auth.uid())
  returning id into new_rule_set_id;

  insert into public.rules (rule_set_id, code, severity, blocking, parameters, scope, legal_basis)
  values
    (new_rule_set_id, 'INTERJOURNEY_MIN', 'critical', true, '{"minimum_minutes":660}'::jsonb, '{}'::jsonb, 'CLT, art. 66'),
    (new_rule_set_id, 'SEGMENT_OVERLAP', 'critical', true, '{}'::jsonb, '{}'::jsonb, 'Integridade da escala'),
    (new_rule_set_id, 'WEEKLY_REST_WINDOW', 'critical', true, '{"maximum_consecutive_days":7}'::jsonb, '{}'::jsonb, 'Regra operacional: sem mais de 7 dias consecutivos'),
    (new_rule_set_id, 'SUNDAY_REST_AROUND', 'critical', true, '{"pre_days":6,"post_days":6}'::jsonb, '{}'::jsonb, 'Regra operacional aprovada: folga antes e depois do domingo trabalhado'),
    (new_rule_set_id, 'SUNDAY_REST_ROTATION', 'critical', true, '{"window_weeks":3,"maximum_worked_sundays":2}'::jsonb, '{}'::jsonb, 'Lei 10.101/2000, art. 6º, parágrafo único; sujeito à norma coletiva aplicável'),
    (new_rule_set_id, 'SUNDAY_REST_ROTATION_WOMEN', 'warning', false, '{}'::jsonb, '{}'::jsonb, 'CLT, art. 386 (revezamento quinzenal para mulheres) — confirmar vigência conforme convenção coletiva aplicável'),
    (new_rule_set_id, 'INTRADAY_BREAK', 'warning', false, '{"threshold_over_hours":6,"threshold_partial_hours":4,"minimum_break_over_minutes":60,"minimum_break_partial_minutes":15}'::jsonb, '{}'::jsonb, 'CLT, art. 71'),
    (new_rule_set_id, 'DAILY_MINUTES', 'warning', false, '{"maximum_minutes":600}'::jsonb, '{}'::jsonb, 'CLT, art. 59'),
    (new_rule_set_id, 'WEEKLY_MINUTES', 'warning', false, '{"tolerance_minutes":0,"default_weekly_minutes":2640}'::jsonb, '{}'::jsonb, 'Contrato de trabalho'),
    (new_rule_set_id, 'EMPLOYEE_UNAVAILABLE', 'warning', false, '{}'::jsonb, '{}'::jsonb, 'Restrição de disponibilidade cadastrada'),
    (new_rule_set_id, 'SECTOR_COVERAGE', 'warning', false, '{}'::jsonb, '{}'::jsonb, 'Necessidade operacional da loja'),
    (new_rule_set_id, 'HOLIDAY_AUTHORIZATION', 'warning', false, '{}'::jsonb, '{}'::jsonb, 'CLT, art. 70; convenção coletiva aplicável');

  return new_store;
end;
$$;
