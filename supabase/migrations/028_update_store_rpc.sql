-- There was no way to edit a store's own name/city/state after onboarding (bootstrap_store only
-- inserts once) and no RLS policy allowed writing to public.stores at all. Follows the same
-- RPC-over-raw-table-write pattern as upsert_employee/update_store_member instead of adding an
-- UPDATE policy, so validation and the manager check live in one place.

create or replace function public.update_store(
  p_store_id uuid,
  p_name text,
  p_city text,
  p_state text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_store(p_store_id) then
    raise exception 'Only a store manager can edit store details';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Store name is required';
  end if;
  if length(trim(coalesce(p_state, ''))) not in (0, 2) then
    raise exception 'State must be a 2-letter UF code';
  end if;
  update public.stores set
    name = trim(p_name),
    city = nullif(trim(coalesce(p_city, '')), ''),
    state = nullif(upper(trim(coalesce(p_state, ''))), '')
  where id = p_store_id;
end;
$$;

revoke execute on function public.update_store(uuid, text, text, text) from anon, public;
grant execute on function public.update_store(uuid, text, text, text) to authenticated;
