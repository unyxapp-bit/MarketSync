-- Deny-by-default RLS for the canonical model.

create or replace function public.can_access_organization(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_memberships m
    join public.stores s on s.id = m.store_id
    where m.user_id = auth.uid() and s.organization_id = target_organization_id
  );
$$;

alter table public.rule_sets enable row level security;
alter table public.rules enable row level security;
alter table public.employment_contracts enable row level security;
alter table public.employee_constraints enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_versions enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.shift_segments enable row level security;
alter table public.validation_runs enable row level security;
alter table public.violations enable row level security;
alter table public.approvals enable row level security;
alter table public.publications enable row level security;
alter table public.notifications enable row level security;
alter table public.acknowledgements enable row level security;

create policy "members view rule sets" on public.rule_sets for select using (public.can_access_organization(organization_id));
create policy "owners manage rule sets" on public.rule_sets for all using (exists (select 1 from public.store_memberships m join public.stores s on s.id = m.store_id where m.user_id = auth.uid() and m.role = 'owner' and s.organization_id = rule_sets.organization_id)) with check (exists (select 1 from public.store_memberships m join public.stores s on s.id = m.store_id where m.user_id = auth.uid() and m.role = 'owner' and s.organization_id = rule_sets.organization_id));
create policy "members view rules" on public.rules for select using (exists (select 1 from public.rule_sets rs where rs.id = rule_set_id and public.can_access_organization(rs.organization_id)));

create policy "members view contracts" on public.employment_contracts for select using (exists (select 1 from public.employees e where e.id = employee_id and public.can_access_store(e.store_id)));
create policy "managers manage contracts" on public.employment_contracts for all using (exists (select 1 from public.employees e where e.id = employee_id and public.can_manage_store(e.store_id))) with check (exists (select 1 from public.employees e where e.id = employee_id and public.can_manage_store(e.store_id)));
create policy "members view constraints" on public.employee_constraints for select using (exists (select 1 from public.employees e where e.id = employee_id and public.can_access_store(e.store_id)));
create policy "managers manage constraints" on public.employee_constraints for all using (exists (select 1 from public.employees e where e.id = employee_id and public.can_manage_store(e.store_id))) with check (exists (select 1 from public.employees e where e.id = employee_id and public.can_manage_store(e.store_id)));

create policy "members view schedules" on public.schedules for select using (public.can_access_store(store_id));
create policy "managers manage schedules canonical" on public.schedules for all using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy "members view schedule versions" on public.schedule_versions for select using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_access_store(s.store_id)));
create policy "members view entries" on public.schedule_entries for select using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_access_store(s.store_id)));
create policy "members view segments" on public.shift_segments for select using (exists (select 1 from public.schedule_entries e join public.schedules s on s.id = e.schedule_id where e.id = entry_id and public.can_access_store(s.store_id)));
create policy "members view validation runs" on public.validation_runs for select using (exists (select 1 from public.schedules s where s.id = schedule_id and public.can_access_store(s.store_id)));
create policy "members view violations" on public.violations for select using (exists (select 1 from public.validation_runs vr join public.schedules s on s.id = vr.schedule_id where vr.id = validation_run_id and public.can_access_store(s.store_id)));
create policy "members view approvals" on public.approvals for select using (exists (select 1 from public.schedule_versions sv join public.schedules s on s.id = sv.schedule_id where sv.id = schedule_version_id and public.can_access_store(s.store_id)));
create policy "members view publications" on public.publications for select using (exists (select 1 from public.schedule_versions sv join public.schedules s on s.id = sv.schedule_id where sv.id = schedule_version_id and public.can_access_store(s.store_id)));
create policy "members view notifications" on public.notifications for select using (exists (select 1 from public.employees e where e.id = employee_id and public.can_access_store(e.store_id)));
create policy "employees acknowledge own publication" on public.acknowledgements for insert with check (exists (select 1 from public.employees e where e.id = employee_id and e.profile_id = auth.uid()));
create policy "members view acknowledgements" on public.acknowledgements for select using (exists (select 1 from public.employees e where e.id = employee_id and public.can_access_store(e.store_id)));
