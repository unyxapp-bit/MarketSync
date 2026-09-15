-- Performance hardening from the Supabase performance advisor audit (2026-09-14).

-- 1) Covering indexes for every foreign key the advisor flagged as unindexed. RLS policies join
--    through most of these on every request, so this matters well before table sizes get large.
create index if not exists acknowledgements_employee_id_idx on public.acknowledgements (employee_id);
create index if not exists approvals_approver_id_idx on public.approvals (approver_id);
create index if not exists approvals_schedule_version_id_idx on public.approvals (schedule_version_id);
create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_organization_id_idx on public.audit_logs (organization_id);
create index if not exists employee_constraints_employee_id_idx on public.employee_constraints (employee_id);
create index if not exists employees_sector_id_idx on public.employees (sector_id);
create index if not exists employees_store_id_idx on public.employees (store_id);
create index if not exists employment_contracts_employee_id_idx on public.employment_contracts (employee_id);
create index if not exists employment_contracts_rule_set_id_idx on public.employment_contracts (rule_set_id);
create index if not exists member_sectors_sector_id_idx on public.member_sectors (sector_id);
create index if not exists notifications_employee_id_idx on public.notifications (employee_id);
create index if not exists notifications_publication_id_idx on public.notifications (publication_id);
create index if not exists publications_published_by_idx on public.publications (published_by);
create index if not exists rule_sets_approved_by_idx on public.rule_sets (approved_by);
create index if not exists schedule_audit_events_actor_id_idx on public.schedule_audit_events (actor_id);
create index if not exists schedule_audit_events_schedule_week_id_idx on public.schedule_audit_events (schedule_week_id);
create index if not exists schedule_edit_locks_employee_id_idx on public.schedule_edit_locks (employee_id);
create index if not exists schedule_edit_locks_locked_by_idx on public.schedule_edit_locks (locked_by);
create index if not exists schedule_entries_employee_id_idx on public.schedule_entries (employee_id);
create index if not exists schedule_versions_created_by_idx on public.schedule_versions (created_by);
create index if not exists schedule_weeks_created_by_idx on public.schedule_weeks (created_by);
create index if not exists schedule_weeks_published_by_idx on public.schedule_weeks (published_by);
create index if not exists schedules_created_by_idx on public.schedules (created_by);
create index if not exists schedules_rule_set_id_idx on public.schedules (rule_set_id);
create index if not exists shifts_schedule_week_id_idx on public.shifts (schedule_week_id);
create index if not exists shifts_updated_by_idx on public.shifts (updated_by);
create index if not exists store_memberships_user_id_idx on public.store_memberships (user_id);
create index if not exists stores_organization_id_idx on public.stores (organization_id);
create index if not exists validation_runs_rule_set_id_idx on public.validation_runs (rule_set_id);
create index if not exists validation_runs_schedule_id_idx on public.validation_runs (schedule_id);
create index if not exists violations_employee_id_idx on public.violations (employee_id);
create index if not exists violations_entry_id_idx on public.violations (entry_id);
create index if not exists violations_resolved_by_idx on public.violations (resolved_by);

-- 2) auth_rls_initplan: wrap auth.uid() so Postgres evaluates it once per query instead of once
--    per row.
drop policy "users can view their profile" on public.profiles;
create policy "users can view their profile" on public.profiles for select using (id = (select auth.uid()));

drop policy "users can update their profile" on public.profiles;
create policy "users can update their profile" on public.profiles for update using (id = (select auth.uid()));

drop policy "members can view memberships" on public.store_memberships;
create policy "members can view memberships" on public.store_memberships for select using (
  user_id = (select auth.uid()) or public.can_access_store(store_id)
);

drop policy "employees acknowledge own publication" on public.acknowledgements;
create policy "employees acknowledge own publication" on public.acknowledgements for insert with check (
  exists (select 1 from public.employees e where e.id = employee_id and e.profile_id = (select auth.uid()))
);

-- 3) multiple_permissive_policies: every "managers can manage X" policy was declared FOR ALL,
--    which duplicates (and re-runs) the dedicated "members can view X" policy on every SELECT.
--    can_manage_store(...) always implies can_access_store(...), so the view policy already
--    covers managers for reads; split the manage policies into insert/update/delete only.

drop policy "managers can manage sectors" on public.sectors;
create policy "managers can insert sectors" on public.sectors for insert with check (public.can_manage_store(store_id));
create policy "managers can update sectors" on public.sectors for update using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy "managers can delete sectors" on public.sectors for delete using (public.can_manage_store(store_id));

drop policy "managers can manage employees" on public.employees;
create policy "managers can insert employees" on public.employees for insert with check (public.can_manage_store(store_id));
create policy "managers can update employees" on public.employees for update using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy "managers can delete employees" on public.employees for delete using (public.can_manage_store(store_id));

drop policy "managers can manage schedules" on public.schedule_weeks;
create policy "managers can insert schedule weeks" on public.schedule_weeks for insert with check (public.can_manage_store(store_id));
create policy "managers can update schedule weeks" on public.schedule_weeks for update using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy "managers can delete schedule weeks" on public.schedule_weeks for delete using (public.can_manage_store(store_id));

drop policy "managers can manage shifts" on public.shifts;
create policy "managers can insert shifts" on public.shifts for insert with check (
  exists (select 1 from public.schedule_weeks w where w.id = schedule_week_id and public.can_manage_store(w.store_id))
);
create policy "managers can update shifts" on public.shifts for update using (
  exists (select 1 from public.schedule_weeks w where w.id = schedule_week_id and public.can_manage_store(w.store_id))
) with check (
  exists (select 1 from public.schedule_weeks w where w.id = schedule_week_id and public.can_manage_store(w.store_id))
);
create policy "managers can delete shifts" on public.shifts for delete using (
  exists (select 1 from public.schedule_weeks w where w.id = schedule_week_id and public.can_manage_store(w.store_id))
);

drop policy "managers can manage sector scopes" on public.member_sectors;
create policy "managers can insert sector scopes" on public.member_sectors for insert with check (public.can_manage_store(store_id));
create policy "managers can update sector scopes" on public.member_sectors for update using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy "managers can delete sector scopes" on public.member_sectors for delete using (public.can_manage_store(store_id));

drop policy "managers manage contracts" on public.employment_contracts;
create policy "managers can insert contracts" on public.employment_contracts for insert with check (
  exists (select 1 from public.employees e where e.id = employee_id and public.can_manage_store(e.store_id))
);
create policy "managers can update contracts" on public.employment_contracts for update using (
  exists (select 1 from public.employees e where e.id = employee_id and public.can_manage_store(e.store_id))
) with check (
  exists (select 1 from public.employees e where e.id = employee_id and public.can_manage_store(e.store_id))
);
create policy "managers can delete contracts" on public.employment_contracts for delete using (
  exists (select 1 from public.employees e where e.id = employee_id and public.can_manage_store(e.store_id))
);

drop policy "managers manage constraints" on public.employee_constraints;
create policy "managers can insert constraints" on public.employee_constraints for insert with check (
  exists (select 1 from public.employees e where e.id = employee_id and public.can_manage_store(e.store_id))
);
create policy "managers can update constraints" on public.employee_constraints for update using (
  exists (select 1 from public.employees e where e.id = employee_id and public.can_manage_store(e.store_id))
) with check (
  exists (select 1 from public.employees e where e.id = employee_id and public.can_manage_store(e.store_id))
);
create policy "managers can delete constraints" on public.employee_constraints for delete using (
  exists (select 1 from public.employees e where e.id = employee_id and public.can_manage_store(e.store_id))
);

drop policy "owners manage rule sets" on public.rule_sets;
create policy "owners can insert rule sets" on public.rule_sets for insert with check (
  exists (select 1 from public.store_memberships m join public.stores s on s.id = m.store_id where m.user_id = (select auth.uid()) and m.role = 'owner' and s.organization_id = rule_sets.organization_id)
);
create policy "owners can update rule sets" on public.rule_sets for update using (
  exists (select 1 from public.store_memberships m join public.stores s on s.id = m.store_id where m.user_id = (select auth.uid()) and m.role = 'owner' and s.organization_id = rule_sets.organization_id)
) with check (
  exists (select 1 from public.store_memberships m join public.stores s on s.id = m.store_id where m.user_id = (select auth.uid()) and m.role = 'owner' and s.organization_id = rule_sets.organization_id)
);
create policy "owners can delete rule sets" on public.rule_sets for delete using (
  exists (select 1 from public.store_memberships m join public.stores s on s.id = m.store_id where m.user_id = (select auth.uid()) and m.role = 'owner' and s.organization_id = rule_sets.organization_id)
);

drop policy "managers manage schedules canonical" on public.schedules;
create policy "managers can insert schedules" on public.schedules for insert with check (public.can_manage_store(store_id));
create policy "managers can update schedules" on public.schedules for update using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy "managers can delete schedules" on public.schedules for delete using (public.can_manage_store(store_id));
