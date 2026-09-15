-- Lets an organization owner create a new rule_set version instead of overwriting the active
-- one in place, per spec: "Editar uma regra ativa cria nova versão em vez de sobrescrever a
-- atual" and "Vigências conflitantes no mesmo escopo são impedidas."

create or replace function public.create_rule_set_revision(
  p_rule_set_id uuid,
  p_effective_from date,
  p_rules jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  current_set public.rule_sets;
  new_set_id uuid;
  new_version integer;
  rule_record record;
begin
  select * into current_set from public.rule_sets where id = p_rule_set_id for update;
  if current_set.id is null then raise exception 'Rule set not found'; end if;
  if not exists (
    select 1 from public.store_memberships m join public.stores s on s.id = m.store_id
    where m.user_id = auth.uid() and m.role = 'owner' and s.organization_id = current_set.organization_id
  ) then raise exception 'Only an organization owner can create a new rule set version'; end if;
  if p_effective_from <= current_set.effective_from then
    raise exception 'The new version must take effect after the current one (%).', current_set.effective_from;
  end if;
  if jsonb_array_length(coalesce(p_rules, '[]'::jsonb)) = 0 then raise exception 'At least one rule is required'; end if;

  select coalesce(max(version), 0) + 1 into new_version
  from public.rule_sets where organization_id = current_set.organization_id and name = current_set.name;

  update public.rule_sets set effective_to = p_effective_from - 1
  where organization_id = current_set.organization_id and name = current_set.name and effective_to is null;

  insert into public.rule_sets (organization_id, name, version, effective_from, approved_by)
  values (current_set.organization_id, current_set.name, new_version, p_effective_from, auth.uid())
  returning id into new_set_id;

  for rule_record in
    select * from jsonb_to_recordset(p_rules)
      as x(code text, severity text, blocking boolean, parameters jsonb, legal_basis text)
  loop
    insert into public.rules (rule_set_id, code, severity, blocking, parameters, scope, legal_basis)
    values (
      new_set_id, rule_record.code, rule_record.severity::public.violation_severity,
      rule_record.blocking, coalesce(rule_record.parameters, '{}'::jsonb), '{}'::jsonb, rule_record.legal_basis
    );
  end loop;

  insert into public.audit_logs (organization_id, actor_id, action, entity_type, entity_id, payload)
  values (current_set.organization_id, auth.uid(), 'rule_set_revised', 'rule_set', new_set_id,
    jsonb_build_object('previousRuleSetId', current_set.id, 'version', new_version, 'effectiveFrom', p_effective_from));

  return new_set_id;
end;
$$;

revoke execute on function public.create_rule_set_revision(uuid, date, jsonb) from public;
grant execute on function public.create_rule_set_revision(uuid, date, jsonb) to authenticated;
