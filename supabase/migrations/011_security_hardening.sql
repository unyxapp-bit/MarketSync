-- Security hardening from the Supabase security advisor audit (2026-09-14).

-- Action RPCs are only ever meant to be called by an authenticated session; each one already
-- raises when auth.uid() is null, but there is no reason to leave anon able to invoke them at all.
revoke execute on function public.acquire_shift_lock(uuid, uuid, date) from anon;
revoke execute on function public.bootstrap_store(text, text) from anon;
revoke execute on function public.list_store_team(uuid) from anon;
revoke execute on function public.publish_canonical_schedule(uuid, integer, uuid) from anon;
revoke execute on function public.publish_schedule_week(uuid, integer) from anon;
revoke execute on function public.save_canonical_entry(uuid, uuid, date, public.schedule_day_type, jsonb, integer, text) from anon;
revoke execute on function public.save_shift_revision(uuid, uuid, date, time, time, time, time, public.shift_status, integer, text) from anon;
revoke execute on function public.sync_legacy_week_to_canonical(uuid) from anon;
revoke execute on function public.update_store_member(uuid, uuid, public.member_role, uuid[], boolean) from anon;

-- handle_new_user only ever needs to run as the on_auth_user_created trigger (executed by the
-- Auth service role); no client session should be able to call it directly.
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Pin the search_path on the one trigger function that was left without it.
create or replace function public.touch_schedule_week()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- organizations had RLS enabled with no policy at all, so it was unreadable by anyone,
-- including the members of that organization. Let members read their own organization's row.
create policy "members can view their organization" on public.organizations
  for select using (public.can_access_organization(id));
