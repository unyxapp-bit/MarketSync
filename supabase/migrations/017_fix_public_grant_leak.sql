-- Migration 011 revoked EXECUTE from anon directly, but every one of these functions still had
-- the default EXECUTE-to-PUBLIC grant Postgres adds on CREATE FUNCTION. anon inherits through
-- PUBLIC membership, so "revoke ... from anon" alone was a no-op: the security advisor still
-- flagged all of these as anon-executable after migration 011 applied. Revoking from PUBLIC
-- removes the inherited path; authenticated keeps working because it already has its own direct
-- grant, applied again here to be explicit.

revoke execute on function public.bootstrap_store(text, text) from public;
grant execute on function public.bootstrap_store(text, text) to authenticated;

revoke execute on function public.decide_schedule_approval(uuid, integer, text, text) from public;
grant execute on function public.decide_schedule_approval(uuid, integer, text, text) to authenticated;

revoke execute on function public.handle_new_user() from public;

revoke execute on function public.list_store_team(uuid) from public;
grant execute on function public.list_store_team(uuid) to authenticated;

revoke execute on function public.resolve_violation(uuid, text) from public;
grant execute on function public.resolve_violation(uuid, text) to authenticated;

revoke execute on function public.submit_schedule_for_approval(uuid, integer) from public;
grant execute on function public.submit_schedule_for_approval(uuid, integer) to authenticated;

revoke execute on function public.sync_legacy_week_to_canonical(uuid) from public;
grant execute on function public.sync_legacy_week_to_canonical(uuid) to authenticated;

revoke execute on function public.update_store_member(uuid, uuid, public.member_role, uuid[], boolean) from public;
grant execute on function public.update_store_member(uuid, uuid, public.member_role, uuid[], boolean) to authenticated;
