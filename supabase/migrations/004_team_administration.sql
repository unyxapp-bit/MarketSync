-- Team administration APIs. Invitations are performed by a server-side Edge Function.

create or replace function public.list_store_team(p_store_id uuid)
returns table (user_id uuid, full_name text, role public.member_role, sector_ids uuid[], can_edit_sector boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.full_name, m.role,
    coalesce(array_agg(ms.sector_id) filter (where ms.sector_id is not null), '{}'::uuid[]) as sector_ids,
    coalesce(bool_or(ms.can_edit), false) as can_edit_sector
  from public.store_memberships m
  join public.profiles p on p.id = m.user_id
  left join public.member_sectors ms on ms.store_id = m.store_id and ms.user_id = m.user_id
  where m.store_id = p_store_id and public.can_manage_store(p_store_id)
  group by m.user_id, p.full_name, m.role
  order by p.full_name;
$$;

create or replace function public.update_store_member(
  p_store_id uuid, p_user_id uuid, p_role public.member_role, p_sector_ids uuid[] default '{}', p_can_edit boolean default false
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_store(p_store_id) then raise exception 'Only store managers can change permissions'; end if;
  if p_role = 'owner' and not exists (select 1 from public.store_memberships where store_id = p_store_id and user_id = auth.uid() and role = 'owner') then
    raise exception 'Only an owner can grant owner access';
  end if;
  update public.store_memberships set role = p_role where store_id = p_store_id and user_id = p_user_id;
  delete from public.member_sectors where store_id = p_store_id and user_id = p_user_id;
  insert into public.member_sectors (store_id, user_id, sector_id, can_edit)
  select p_store_id, p_user_id, unnest(p_sector_ids), p_can_edit
  on conflict (store_id, user_id, sector_id) do update set can_edit = excluded.can_edit;
end;
$$;

grant execute on function public.list_store_team(uuid) to authenticated;
grant execute on function public.update_store_member(uuid, uuid, public.member_role, uuid[], boolean) to authenticated;
