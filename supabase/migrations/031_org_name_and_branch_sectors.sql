-- Two gaps found while reviewing "configuração da loja" and "novas implantações":
--   1. The organization's own name (set once at onboarding) had no edit path anywhere in the app.
--   2. create_branch_store cloned the source store's rules but not its sectors, so a new filial's
--      cloned SECTOR_COVERAGE rule referenced sector names that didn't exist yet at the new store
--      (dangling parameters) and the filial started with nothing to assign employees to at all.

create or replace function public.update_organization(p_organization_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.store_memberships m join public.stores s on s.id = m.store_id
    where m.user_id = auth.uid() and m.role = 'owner' and s.organization_id = p_organization_id
  ) then
    raise exception 'Only an organization owner can rename the organization';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Organization name is required';
  end if;
  update public.organizations set name = trim(p_name) where id = p_organization_id;
end;
$$;

revoke execute on function public.update_organization(uuid, text) from anon, public;
grant execute on function public.update_organization(uuid, text) to authenticated;

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

  insert into public.sectors (store_id, name, color)
  select new_store.id, s.name, s.color from public.sectors s where s.store_id = p_source_store_id;

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
