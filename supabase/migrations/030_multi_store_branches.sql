-- Multi-store support: an organization owner can now create additional stores (filiais) under
-- their existing organization, not just the one store bootstrap_store creates. Store-level data
-- (employees, sectors, schedules) was already fully isolated per store_id — the one thing that
-- WASN'T was rule_sets, which lived at organization_id and were shared identically by every store
-- in the org (and, as a side effect, let SECTOR_COVERAGE's auto-generated parameters bleed in
-- sector names from every store in the org, not just the one being configured). Rules now belong
-- to a specific store; a new branch starts by cloning its source store's current rules and can
-- diverge freely from there — there's no enforced floor beyond what it started with, by design.

alter table public.rule_sets add column store_id uuid references public.stores(id) on delete cascade;

-- Every organization today has exactly one store (bootstrap_store never made more than one), so
-- this backfill is unambiguous.
update public.rule_sets rs
set store_id = (select st.id from public.stores st where st.organization_id = rs.organization_id order by st.created_at limit 1)
where store_id is null;

alter table public.rule_sets alter column store_id set not null;
create index if not exists rule_sets_store_id_idx on public.rule_sets (store_id);

-- Rules become store-scoped for reads too, matching every other piece of store data.
drop policy if exists "members view rule sets" on public.rule_sets;
create policy "members view rule sets" on public.rule_sets for select using (public.can_access_store(store_id));

drop policy if exists "members view rules" on public.rules;
create policy "members view rules" on public.rules for select using (
  exists (select 1 from public.rule_sets rs where rs.id = rule_set_id and public.can_access_store(rs.store_id))
);

-- These three raw-table policies aren't on the app's normal write path (all writes go through
-- create_rule_set_revision, a SECURITY DEFINER function that bypasses RLS) but are kept in sync
-- for defense in depth: owner/RH of THIS store, not of any store in the organization.
drop policy if exists "owners can insert rule sets" on public.rule_sets;
create policy "owners can insert rule sets" on public.rule_sets for insert with check (
  exists (select 1 from public.store_memberships m where m.user_id = (select auth.uid()) and m.role in ('owner', 'rh') and m.store_id = rule_sets.store_id)
);
drop policy if exists "owners can update rule sets" on public.rule_sets;
create policy "owners can update rule sets" on public.rule_sets for update using (
  exists (select 1 from public.store_memberships m where m.user_id = (select auth.uid()) and m.role in ('owner', 'rh') and m.store_id = rule_sets.store_id)
) with check (
  exists (select 1 from public.store_memberships m where m.user_id = (select auth.uid()) and m.role in ('owner', 'rh') and m.store_id = rule_sets.store_id)
);
drop policy if exists "owners can delete rule sets" on public.rule_sets;
create policy "owners can delete rule sets" on public.rule_sets for delete using (
  exists (select 1 from public.store_memberships m where m.user_id = (select auth.uid()) and m.role in ('owner', 'rh') and m.store_id = rule_sets.store_id)
);

-- Picks the rule set that applies to a store's week; used whenever a new schedule is created.
-- Previously joined through organization_id (any store in the org); now direct on store_id.
create or replace function public.active_rule_set_for_store(p_store_id uuid, p_week_start date)
returns uuid language sql stable security definer set search_path = public as $$
  select rs.id
  from public.rule_sets rs
  where rs.store_id = p_store_id
    and rs.effective_from <= p_week_start
    and (rs.effective_to is null or rs.effective_to >= p_week_start)
  order by rs.effective_from desc, rs.version desc
  limit 1;
$$;

-- Same shape as before, but "who can edit" and "what's the current version" are now scoped to
-- the rule set's own store instead of any store in the organization.
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
    select 1 from public.store_memberships m
    where m.user_id = auth.uid() and m.role in ('owner', 'rh') and m.store_id = current_set.store_id
  ) then raise exception 'Only this store''s owner or RH/DP can create a new rule set version'; end if;
  if p_effective_from <= current_set.effective_from then
    raise exception 'The new version must take effect after the current one (%).', current_set.effective_from;
  end if;
  if jsonb_array_length(coalesce(p_rules, '[]'::jsonb)) = 0 then raise exception 'At least one rule is required'; end if;

  select coalesce(max(version), 0) + 1 into new_version
  from public.rule_sets where store_id = current_set.store_id and name = current_set.name;

  update public.rule_sets set effective_to = p_effective_from - 1
  where store_id = current_set.store_id and name = current_set.name and effective_to is null;

  insert into public.rule_sets (organization_id, store_id, name, version, effective_from, approved_by)
  values (current_set.organization_id, current_set.store_id, current_set.name, new_version, p_effective_from, auth.uid())
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

  insert into public.audit_logs (organization_id, store_id, actor_id, action, entity_type, entity_id, payload)
  values (current_set.organization_id, current_set.store_id, auth.uid(), 'rule_set_revised', 'rule_set', new_set_id,
    jsonb_build_object('previousRuleSetId', current_set.id, 'version', new_version, 'effectiveFrom', p_effective_from));

  return new_set_id;
end;
$$;

-- Creates a new store (filial) under an existing organization. Only an organization owner (owner
-- of at least one of its existing stores) can do this; the caller becomes 'owner' of the new store
-- too, and the new store's rules start as a clone of p_source_store_id's current active rules.
create or replace function public.create_branch_store(
  p_organization_id uuid,
  p_source_store_id uuid,
  p_name text,
  p_city text default null,
  p_state text default null
) returns public.stores language plpgsql security definer set search_path = public as $$
declare
  new_store public.stores;
  source_set public.rule_sets;
  new_set_id uuid;
begin
  if not exists (
    select 1 from public.store_memberships m join public.stores s on s.id = m.store_id
    where m.user_id = auth.uid() and m.role = 'owner' and s.organization_id = p_organization_id
  ) then
    raise exception 'Only an organization owner can create a new store';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Store name is required'; end if;
  if p_state is not null and length(trim(p_state)) not in (0, 2) then
    raise exception 'State must be a 2-letter UF code';
  end if;

  insert into public.stores (organization_id, name, city, state)
  values (p_organization_id, trim(p_name), nullif(trim(coalesce(p_city, '')), ''), nullif(upper(trim(coalesce(p_state, ''))), ''))
  returning * into new_store;

  insert into public.store_memberships (store_id, user_id, role) values (new_store.id, auth.uid(), 'owner');

  select * into source_set from public.rule_sets
  where store_id = p_source_store_id and effective_to is null
  order by version desc limit 1;

  if source_set.id is not null then
    insert into public.rule_sets (organization_id, store_id, name, version, effective_from, approved_by)
    values (p_organization_id, new_store.id, source_set.name, 1, current_date, auth.uid())
    returning id into new_set_id;

    insert into public.rules (rule_set_id, code, severity, blocking, parameters, scope, legal_basis)
    select new_set_id, r.code, r.severity, r.blocking, r.parameters, r.scope, r.legal_basis
    from public.rules r where r.rule_set_id = source_set.id;
  end if;

  insert into public.audit_logs (organization_id, store_id, actor_id, action, entity_type, entity_id, payload)
  values (p_organization_id, new_store.id, auth.uid(), 'store_created', 'store', new_store.id,
    jsonb_build_object('name', new_store.name, 'sourceStoreId', p_source_store_id));

  return new_store;
end;
$$;

revoke execute on function public.create_branch_store(uuid, uuid, text, text, text) from anon, public;
grant execute on function public.create_branch_store(uuid, uuid, text, text, text) to authenticated;
