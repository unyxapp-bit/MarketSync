-- One-time historical backfill for the pilot store (CARROSSEL BAEPENDI), generated from
-- the transcriptions that used to live only in src/data/realSchedule.ts. App.tsx now
-- reads compliance history (prior workdays, Sunday rotation) from Supabase for whichever
-- week is on screen instead of those hardcoded constants, so the history needs to actually
-- exist as canonical schedules/schedule_entries/shift_segments rows. This keeps the
-- Sep 14-20 2026 pilot week's compliance indicators identical to what they showed before.
-- Safe to run more than once: every insert is guarded by a not-exists check on week_start.
do $$
declare
  v_store_id uuid := '4740ebb7-9850-4619-bd57-af62ebb92935';
  v_schedule_id uuid;
  v_entry_id uuid;
begin
  if not exists (select 1 from public.schedules where store_id = v_store_id and week_start = date '2026-09-07') then
    insert into public.schedules (store_id, week_start, status, revision, rule_set_id, created_at, updated_at)
    values (v_store_id, date '2026-09-07', 'archived', 1, public.active_rule_set_for_store(v_store_id, date '2026-09-07'), now(), now())
    returning id into v_schedule_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '7486428f-57a7-4c04-a084-17963448aca9', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 07:40:00-03:00', timestamptz '2026-09-11 12:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 14:30:00-03:00', timestamptz '2026-09-11 17:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '7486428f-57a7-4c04-a084-17963448aca9', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 07:40:00-03:00', timestamptz '2026-09-12 12:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 14:30:00-03:00', timestamptz '2026-09-12 17:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '7486428f-57a7-4c04-a084-17963448aca9', date '2026-09-13', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '780cd520-3094-44cb-92e1-8f2b8a85eac5', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 07:40:00-03:00', timestamptz '2026-09-11 12:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 14:30:00-03:00', timestamptz '2026-09-11 17:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '780cd520-3094-44cb-92e1-8f2b8a85eac5', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 07:40:00-03:00', timestamptz '2026-09-12 12:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 14:30:00-03:00', timestamptz '2026-09-12 17:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '780cd520-3094-44cb-92e1-8f2b8a85eac5', date '2026-09-13', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-13 07:50:00-03:00', timestamptz '2026-09-13 09:15:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-13 09:30:00-03:00', timestamptz '2026-09-13 13:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '514edf62-1a2f-4288-9bd2-bffc689a1a32', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 07:40:00-03:00', timestamptz '2026-09-11 12:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 14:30:00-03:00', timestamptz '2026-09-11 17:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '514edf62-1a2f-4288-9bd2-bffc689a1a32', date '2026-09-12', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '514edf62-1a2f-4288-9bd2-bffc689a1a32', date '2026-09-13', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-13 07:50:00-03:00', timestamptz '2026-09-13 09:15:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-13 09:30:00-03:00', timestamptz '2026-09-13 13:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '7b07396d-8757-4e8a-a2b7-406f12149629', date '2026-09-11', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '7b07396d-8757-4e8a-a2b7-406f12149629', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 07:40:00-03:00', timestamptz '2026-09-12 12:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 14:30:00-03:00', timestamptz '2026-09-12 17:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '7b07396d-8757-4e8a-a2b7-406f12149629', date '2026-09-13', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-13 07:50:00-03:00', timestamptz '2026-09-13 09:15:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-13 09:30:00-03:00', timestamptz '2026-09-13 13:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'f9b81136-11fd-43aa-a3c7-156cb014ccde', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 07:40:00-03:00', timestamptz '2026-09-11 12:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 14:30:00-03:00', timestamptz '2026-09-11 17:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'f9b81136-11fd-43aa-a3c7-156cb014ccde', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 07:40:00-03:00', timestamptz '2026-09-12 12:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 14:30:00-03:00', timestamptz '2026-09-12 17:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'f9b81136-11fd-43aa-a3c7-156cb014ccde', date '2026-09-13', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-13 07:50:00-03:00', timestamptz '2026-09-13 09:15:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-13 09:30:00-03:00', timestamptz '2026-09-13 13:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '7986c180-28b5-4744-ab6f-9f7a05a6efe6', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 07:40:00-03:00', timestamptz '2026-09-11 12:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 14:30:00-03:00', timestamptz '2026-09-11 17:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '7986c180-28b5-4744-ab6f-9f7a05a6efe6', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 11:20:00-03:00', timestamptz '2026-09-12 14:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 16:30:00-03:00', timestamptz '2026-09-12 20:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '7986c180-28b5-4744-ab6f-9f7a05a6efe6', date '2026-09-13', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '97983559-ca2b-469d-ac27-7a401d6cd653', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 11:20:00-03:00', timestamptz '2026-09-11 14:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 16:30:00-03:00', timestamptz '2026-09-11 20:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '97983559-ca2b-469d-ac27-7a401d6cd653', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 11:20:00-03:00', timestamptz '2026-09-12 14:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 16:30:00-03:00', timestamptz '2026-09-12 20:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '97983559-ca2b-469d-ac27-7a401d6cd653', date '2026-09-13', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '734273d4-b81d-4147-a6d7-85c1d31c2397', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 09:00:00-03:00', timestamptz '2026-09-11 13:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 15:00:00-03:00', timestamptz '2026-09-11 19:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '734273d4-b81d-4147-a6d7-85c1d31c2397', date '2026-09-12', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '734273d4-b81d-4147-a6d7-85c1d31c2397', date '2026-09-13', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-13 07:50:00-03:00', timestamptz '2026-09-13 09:15:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-13 09:30:00-03:00', timestamptz '2026-09-13 13:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'de8ec21e-8df4-43fa-9f04-09114592e208', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 10:30:00-03:00', timestamptz '2026-09-11 14:20:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 16:20:00-03:00', timestamptz '2026-09-11 20:30:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'de8ec21e-8df4-43fa-9f04-09114592e208', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 07:40:00-03:00', timestamptz '2026-09-12 12:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 14:30:00-03:00', timestamptz '2026-09-12 17:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'de8ec21e-8df4-43fa-9f04-09114592e208', date '2026-09-13', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-13 07:50:00-03:00', timestamptz '2026-09-13 09:15:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-13 09:30:00-03:00', timestamptz '2026-09-13 13:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '8e304d05-fd71-4896-9a94-1aabcb811d3b', date '2026-09-11', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '8e304d05-fd71-4896-9a94-1aabcb811d3b', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 09:00:00-03:00', timestamptz '2026-09-12 13:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 15:00:00-03:00', timestamptz '2026-09-12 19:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '8e304d05-fd71-4896-9a94-1aabcb811d3b', date '2026-09-13', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-13 07:50:00-03:00', timestamptz '2026-09-13 09:15:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-13 09:30:00-03:00', timestamptz '2026-09-13 13:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '1277b814-fbf9-4808-9488-c8f89e735b8f', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 12:20:00-03:00', timestamptz '2026-09-11 16:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 17:30:00-03:00', timestamptz '2026-09-11 21:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '1277b814-fbf9-4808-9488-c8f89e735b8f', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 12:20:00-03:00', timestamptz '2026-09-12 16:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 17:30:00-03:00', timestamptz '2026-09-12 21:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '1277b814-fbf9-4808-9488-c8f89e735b8f', date '2026-09-13', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'f2387b5a-15b6-41da-83df-529181276112', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 12:20:00-03:00', timestamptz '2026-09-11 16:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 17:30:00-03:00', timestamptz '2026-09-11 21:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'f2387b5a-15b6-41da-83df-529181276112', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 12:20:00-03:00', timestamptz '2026-09-12 16:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 17:30:00-03:00', timestamptz '2026-09-12 21:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'f2387b5a-15b6-41da-83df-529181276112', date '2026-09-13', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '53bdf876-18e1-456e-b45e-03b665fc2aff', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 12:20:00-03:00', timestamptz '2026-09-11 16:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 17:30:00-03:00', timestamptz '2026-09-11 21:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '53bdf876-18e1-456e-b45e-03b665fc2aff', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 12:20:00-03:00', timestamptz '2026-09-12 16:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 17:30:00-03:00', timestamptz '2026-09-12 21:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '53bdf876-18e1-456e-b45e-03b665fc2aff', date '2026-09-13', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '8957dfeb-6873-4380-a666-f5398a1998e2', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 12:20:00-03:00', timestamptz '2026-09-11 16:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 17:30:00-03:00', timestamptz '2026-09-11 21:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '8957dfeb-6873-4380-a666-f5398a1998e2', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 12:20:00-03:00', timestamptz '2026-09-12 16:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 17:30:00-03:00', timestamptz '2026-09-12 21:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '8957dfeb-6873-4380-a666-f5398a1998e2', date '2026-09-13', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '49df1497-63c9-42e4-8ac5-3bce143e33bd', date '2026-09-11', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '49df1497-63c9-42e4-8ac5-3bce143e33bd', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 09:00:00-03:00', timestamptz '2026-09-12 13:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 15:00:00-03:00', timestamptz '2026-09-12 19:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '49df1497-63c9-42e4-8ac5-3bce143e33bd', date '2026-09-13', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-13 07:50:00-03:00', timestamptz '2026-09-13 09:15:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-13 09:30:00-03:00', timestamptz '2026-09-13 13:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'b4dffd12-a74d-4350-acc1-b990ebab3177', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 12:20:00-03:00', timestamptz '2026-09-11 16:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 17:30:00-03:00', timestamptz '2026-09-11 21:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'b4dffd12-a74d-4350-acc1-b990ebab3177', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 12:20:00-03:00', timestamptz '2026-09-12 16:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 17:30:00-03:00', timestamptz '2026-09-12 21:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'b4dffd12-a74d-4350-acc1-b990ebab3177', date '2026-09-13', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '157b0623-b488-4aba-b5d7-1ebc6d891323', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 11:20:00-03:00', timestamptz '2026-09-11 14:20:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 16:20:00-03:00', timestamptz '2026-09-11 21:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '157b0623-b488-4aba-b5d7-1ebc6d891323', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 10:00:00-03:00', timestamptz '2026-09-12 14:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 16:00:00-03:00', timestamptz '2026-09-12 20:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '157b0623-b488-4aba-b5d7-1ebc6d891323', date '2026-09-13', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-13 07:40:00-03:00', timestamptz '2026-09-13 09:15:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-13 09:30:00-03:00', timestamptz '2026-09-13 13:20:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'ecc18b51-f911-410c-bd8d-348c653ff7de', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 07:40:00-03:00', timestamptz '2026-09-11 12:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 14:30:00-03:00', timestamptz '2026-09-11 17:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'ecc18b51-f911-410c-bd8d-348c653ff7de', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 12:40:00-03:00', timestamptz '2026-09-12 16:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 17:00:00-03:00', timestamptz '2026-09-12 21:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'ecc18b51-f911-410c-bd8d-348c653ff7de', date '2026-09-13', 'off')
    returning id into v_entry_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'bce3a32a-58c0-483e-bce4-bc5481961e3c', date '2026-09-11', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-11 12:40:00-03:00', timestamptz '2026-09-11 16:40:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-11 17:40:00-03:00', timestamptz '2026-09-11 21:40:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'bce3a32a-58c0-483e-bce4-bc5481961e3c', date '2026-09-12', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-12 09:00:00-03:00', timestamptz '2026-09-12 12:30:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-12 13:30:00-03:00', timestamptz '2026-09-12 18:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'bce3a32a-58c0-483e-bce4-bc5481961e3c', date '2026-09-13', 'off')
    returning id into v_entry_id;

  end if;

  if not exists (select 1 from public.schedules where store_id = v_store_id and week_start = date '2026-08-17') then
    insert into public.schedules (store_id, week_start, status, revision, rule_set_id, created_at, updated_at)
    values (v_store_id, date '2026-08-17', 'archived', 1, public.active_rule_set_for_store(v_store_id, date '2026-08-17'), now(), now())
    returning id into v_schedule_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '780cd520-3094-44cb-92e1-8f2b8a85eac5', date '2026-08-23', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-23 08:00:00-03:00', timestamptz '2026-08-23 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-23 13:00:00-03:00', timestamptz '2026-08-23 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '97983559-ca2b-469d-ac27-7a401d6cd653', date '2026-08-23', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-23 08:00:00-03:00', timestamptz '2026-08-23 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-23 13:00:00-03:00', timestamptz '2026-08-23 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '157b0623-b488-4aba-b5d7-1ebc6d891323', date '2026-08-23', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-23 08:00:00-03:00', timestamptz '2026-08-23 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-23 13:00:00-03:00', timestamptz '2026-08-23 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'de8ec21e-8df4-43fa-9f04-09114592e208', date '2026-08-23', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-23 08:00:00-03:00', timestamptz '2026-08-23 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-23 13:00:00-03:00', timestamptz '2026-08-23 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'f2387b5a-15b6-41da-83df-529181276112', date '2026-08-23', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-23 08:00:00-03:00', timestamptz '2026-08-23 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-23 13:00:00-03:00', timestamptz '2026-08-23 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '49df1497-63c9-42e4-8ac5-3bce143e33bd', date '2026-08-23', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-23 08:00:00-03:00', timestamptz '2026-08-23 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-23 13:00:00-03:00', timestamptz '2026-08-23 17:00:00-03:00');

  end if;

  if not exists (select 1 from public.schedules where store_id = v_store_id and week_start = date '2026-08-24') then
    insert into public.schedules (store_id, week_start, status, revision, rule_set_id, created_at, updated_at)
    values (v_store_id, date '2026-08-24', 'archived', 1, public.active_rule_set_for_store(v_store_id, date '2026-08-24'), now(), now())
    returning id into v_schedule_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '7b07396d-8757-4e8a-a2b7-406f12149629', date '2026-08-30', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-30 08:00:00-03:00', timestamptz '2026-08-30 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-30 13:00:00-03:00', timestamptz '2026-08-30 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'f9b81136-11fd-43aa-a3c7-156cb014ccde', date '2026-08-30', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-30 08:00:00-03:00', timestamptz '2026-08-30 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-30 13:00:00-03:00', timestamptz '2026-08-30 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '157b0623-b488-4aba-b5d7-1ebc6d891323', date '2026-08-30', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-30 08:00:00-03:00', timestamptz '2026-08-30 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-30 13:00:00-03:00', timestamptz '2026-08-30 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '734273d4-b81d-4147-a6d7-85c1d31c2397', date '2026-08-30', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-30 08:00:00-03:00', timestamptz '2026-08-30 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-30 13:00:00-03:00', timestamptz '2026-08-30 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '8e304d05-fd71-4896-9a94-1aabcb811d3b', date '2026-08-30', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-30 08:00:00-03:00', timestamptz '2026-08-30 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-30 13:00:00-03:00', timestamptz '2026-08-30 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '1277b814-fbf9-4808-9488-c8f89e735b8f', date '2026-08-30', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-30 08:00:00-03:00', timestamptz '2026-08-30 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-30 13:00:00-03:00', timestamptz '2026-08-30 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '53bdf876-18e1-456e-b45e-03b665fc2aff', date '2026-08-30', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-30 08:00:00-03:00', timestamptz '2026-08-30 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-30 13:00:00-03:00', timestamptz '2026-08-30 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'b4dffd12-a74d-4350-acc1-b990ebab3177', date '2026-08-30', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-30 08:00:00-03:00', timestamptz '2026-08-30 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-30 13:00:00-03:00', timestamptz '2026-08-30 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'ecc18b51-f911-410c-bd8d-348c653ff7de', date '2026-08-30', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-08-30 08:00:00-03:00', timestamptz '2026-08-30 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-08-30 13:00:00-03:00', timestamptz '2026-08-30 17:00:00-03:00');

  end if;

  if not exists (select 1 from public.schedules where store_id = v_store_id and week_start = date '2026-08-31') then
    insert into public.schedules (store_id, week_start, status, revision, rule_set_id, created_at, updated_at)
    values (v_store_id, date '2026-08-31', 'archived', 1, public.active_rule_set_for_store(v_store_id, date '2026-08-31'), now(), now())
    returning id into v_schedule_id;

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '780cd520-3094-44cb-92e1-8f2b8a85eac5', date '2026-09-06', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-06 08:00:00-03:00', timestamptz '2026-09-06 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-06 13:00:00-03:00', timestamptz '2026-09-06 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '7986c180-28b5-4744-ab6f-9f7a05a6efe6', date '2026-09-06', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-06 08:00:00-03:00', timestamptz '2026-09-06 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-06 13:00:00-03:00', timestamptz '2026-09-06 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '97983559-ca2b-469d-ac27-7a401d6cd653', date '2026-09-06', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-06 08:00:00-03:00', timestamptz '2026-09-06 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-06 13:00:00-03:00', timestamptz '2026-09-06 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'f2387b5a-15b6-41da-83df-529181276112', date '2026-09-06', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-06 08:00:00-03:00', timestamptz '2026-09-06 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-06 13:00:00-03:00', timestamptz '2026-09-06 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '49df1497-63c9-42e4-8ac5-3bce143e33bd', date '2026-09-06', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-06 08:00:00-03:00', timestamptz '2026-09-06 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-06 13:00:00-03:00', timestamptz '2026-09-06 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, '8957dfeb-6873-4380-a666-f5398a1998e2', date '2026-09-06', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-06 08:00:00-03:00', timestamptz '2026-09-06 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-06 13:00:00-03:00', timestamptz '2026-09-06 17:00:00-03:00');

    insert into public.schedule_entries (schedule_id, employee_id, work_date, day_type)
    values (v_schedule_id, 'ecc18b51-f911-410c-bd8d-348c653ff7de', date '2026-09-06', 'work')
    returning id into v_entry_id;
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 1, timestamptz '2026-09-06 08:00:00-03:00', timestamptz '2026-09-06 12:00:00-03:00');
    insert into public.shift_segments (entry_id, sequence, starts_at, ends_at) values (v_entry_id, 2, timestamptz '2026-09-06 13:00:00-03:00', timestamptz '2026-09-06 17:00:00-03:00');

  end if;

end $$;
