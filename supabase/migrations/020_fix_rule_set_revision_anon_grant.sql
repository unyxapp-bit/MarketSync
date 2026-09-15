-- Migration 019 revoked EXECUTE from PUBLIC, following the pattern that fixed migration 011's
-- functions. That was the wrong pattern here: newly created functions in this project get an
-- explicit EXECUTE grant straight to anon/authenticated (not an inherited PUBLIC grant), so
-- "revoke ... from public" was a no-op for anon on this one. Revoke from anon directly instead.

revoke execute on function public.create_rule_set_revision(uuid, date, jsonb) from anon;
