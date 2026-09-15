-- Quick-fill shift templates ("Manhã", "Tarde" etc.), so a manager doesn't retype the same four
-- times (entrada, início/fim do intervalo, saída) every time they schedule a recurring shift
-- pattern. Deliberately minimal: no drag-and-drop, no per-sector scoping, no keyboard shortcuts —
-- just save/apply/delete from inside the shift editor itself.

create table public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  start_time time not null,
  break_start_time time not null,
  break_end_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);

alter table public.shift_templates enable row level security;

create policy "members can view shift templates" on public.shift_templates
  for select using (public.can_access_store(store_id));
create policy "managers can insert shift templates" on public.shift_templates
  for insert with check (public.can_manage_store(store_id));
create policy "managers can delete shift templates" on public.shift_templates
  for delete using (public.can_manage_store(store_id));
