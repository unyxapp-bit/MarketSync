-- Baseline rules are versioned and may be superseded by the applicable CCT/ACT for each organization.

insert into public.rule_sets (organization_id, name, version, effective_from)
select o.id, 'Padrão operacional MarketSync', 1, date '2026-09-14'
from public.organizations o
on conflict (organization_id, name, version) do nothing;

insert into public.rules (rule_set_id, code, severity, blocking, parameters, scope, legal_basis)
select rs.id, rule.code, rule.severity::public.violation_severity, rule.blocking,
  rule.parameters::jsonb, '{}'::jsonb, rule.legal_basis
from public.rule_sets rs
cross join (values
  ('INTERJOURNEY_MIN', 'critical', true, '{"minimum_minutes":660}', 'CLT, art. 66'),
  ('SEGMENT_OVERLAP', 'critical', true, '{}', 'Integridade da escala'),
  ('WEEKLY_REST_WINDOW', 'critical', true, '{"maximum_consecutive_days":7}', 'Regra operacional: sem mais de 7 dias consecutivos'),
  ('SUNDAY_REST_AROUND', 'critical', true, '{"pre_days":6,"post_days":6}', 'Regra operacional aprovada: folga antes e depois do domingo trabalhado'),
  ('SUNDAY_REST_ROTATION', 'critical', true, '{"window_weeks":3,"maximum_worked_sundays":2}', 'Lei 10.101/2000, art. 6º, parágrafo único; sujeito à norma coletiva aplicável')
) as rule(code, severity, blocking, parameters, legal_basis)
where rs.name = 'Padrão operacional MarketSync' and rs.version = 1
on conflict (rule_set_id, code) do nothing;

update public.schedules s
set rule_set_id = rs.id
from public.stores st
join public.rule_sets rs on rs.organization_id = st.organization_id
  and rs.name = 'Padrão operacional MarketSync' and rs.version = 1
where s.store_id = st.id and s.rule_set_id is null;
