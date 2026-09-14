import { supabase } from './supabase'
import { employees } from '../data/realSchedule'

export type ShiftDraft = {
  employeeId: string
  workDate: string
  start?: string
  breakStart?: string
  breakEnd?: string
  end?: string
  status: 'draft' | 'published' | 'off' | 'leave'
}

const client = () => {
  if (!supabase) throw new Error('Supabase não configurado. Preencha .env.local.')
  return supabase
}

export async function signIn(email: string, password: string) {
  return client().auth.signInWithPassword({ email, password })
}

export async function signUp(fullName: string, email: string, password: string) {
  return client().auth.signUp({ email, password, options: { data: { full_name: fullName } } })
}

export async function createFirstStore(organizationName: string, storeName: string) {
  const { data, error } = await client().rpc('bootstrap_store', { organization_name: organizationName, store_name: storeName })
  if (error) throw error
  return data
}

export async function getMyStores() {
  const { data, error } = await client().from('stores').select('id,name,city,state').order('name')
  if (error) throw error
  return data
}

export async function createWeek(storeId: string, weekStart: string) {
  const { data, error } = await client().from('schedule_weeks').upsert({ store_id: storeId, week_start: weekStart }, { onConflict: 'store_id,week_start' }).select().single()
  if (error) throw error
  return data
}

export async function saveShift(scheduleWeekId: string, shift: ShiftDraft) {
  const { error } = await client().from('shifts').upsert({
    schedule_week_id: scheduleWeekId,
    employee_id: shift.employeeId,
    work_date: shift.workDate,
    starts_at: shift.start ?? null,
    break_starts_at: shift.breakStart ?? null,
    break_ends_at: shift.breakEnd ?? null,
    ends_at: shift.end ?? null,
    status: shift.status,
  }, { onConflict: 'employee_id,work_date' })
  if (error) throw error
}

export async function publishWeek(scheduleId: string, expectedRevision: number) {
  const { data, error } = await client().rpc('publish_canonical_schedule', { p_schedule_id: scheduleId, p_expected_revision: expectedRevision })
  if (error) throw error
  const result = data as { revision: number }
  return result.revision
}

export async function importCsvRows(rows: ShiftDraft[], scheduleWeekId: string) {
  for (const row of rows) await saveShift(scheduleWeekId, row)
  const { error } = await client().from('schedule_audit_events').insert({ schedule_week_id: scheduleWeekId, event_type: 'imported', payload: { rows: rows.length } })
  if (error) throw error
}

export async function importReceivedWeek(storeId: string) {
  const api = client()
  const { data: existingSectors, error: sectorsError } = await api.from('sectors').select('id,name').eq('store_id', storeId)
  if (sectorsError) throw sectorsError
  const sectorIds = new Map((existingSectors ?? []).map((sector) => [sector.name, sector.id]))
  for (const name of ['Caixa', 'Fiscal']) {
    if (!sectorIds.has(name)) {
      const { data, error } = await api.from('sectors').insert({ store_id: storeId, name }).select('id,name').single()
      if (error) throw error
      sectorIds.set(data.name, data.id)
    }
  }
  const { data: existingEmployees, error: employeesError } = await api.from('employees').select('id,full_name').eq('store_id', storeId)
  if (employeesError) throw employeesError
  const employeeIds = new Map((existingEmployees ?? []).map((employee) => [employee.full_name, employee.id]))
  for (const employee of employees) {
    if (!employeeIds.has(employee.name)) {
      const { data, error } = await api.from('employees').insert({ store_id: storeId, sector_id: sectorIds.get(employee.sector), full_name: employee.name, job_title: employee.sector === 'Caixa' ? 'Operador(a) de caixa' : 'Fiscal' }).select('id,full_name').single()
      if (error) throw error
      employeeIds.set(data.full_name, data.id)
    }
  }
  const week = await createWeek(storeId, '2026-09-14')
  const shifts = employees.flatMap((employee) => employee.schedule.map((shift, day) => ({
    schedule_week_id: week.id,
    employee_id: employeeIds.get(employee.name),
    work_date: `2026-09-${String(14 + day).padStart(2, '0')}`,
    starts_at: shift?.start ?? null,
    break_starts_at: shift?.breakStart ?? null,
    break_ends_at: shift?.breakEnd ?? null,
    ends_at: shift?.end ?? null,
    status: shift ? 'draft' : 'off',
  })))
  const { error: shiftsError } = await api.from('shifts').upsert(shifts, { onConflict: 'employee_id,work_date' })
  if (shiftsError) throw shiftsError
  const { error: auditError } = await api.from('schedule_audit_events').insert({ schedule_week_id: week.id, event_type: 'imported', payload: { source: 'received_week_2026_09_14', rows: shifts.length } })
  if (auditError) throw auditError
  const { data: canonicalScheduleId, error: syncError } = await api.rpc('sync_legacy_week_to_canonical', { p_legacy_week_id: week.id })
  if (syncError) throw syncError
  return { ...week, canonicalScheduleId }
}

export async function loadWeek(storeId: string, weekStart: string) {
  const api = client()
  const { data: week, error: weekError } = await api.from('schedule_weeks').select('id,state,week_start,published_at,revision').eq('store_id', storeId).eq('week_start', weekStart).maybeSingle()
  if (weekError) throw weekError
  if (!week) return null
  const { data: employeeRows, error: employeeError } = await api.from('employees').select('id,full_name,job_title,sector_id,sectors(name)').eq('store_id', storeId).eq('active', true).order('full_name')
  if (employeeError) throw employeeError
  const { data: shiftRows, error: shiftError } = await api.from('shifts').select('employee_id,work_date,starts_at,break_starts_at,break_ends_at,ends_at,status').eq('schedule_week_id', week.id)
  if (shiftError) throw shiftError
  return { week, employees: employeeRows ?? [], shifts: shiftRows ?? [] }
}

export async function loadCanonicalWeek(storeId: string, weekStart: string) {
  const api = client()
  const { data: schedule, error: scheduleError } = await api.from('schedules').select('id,status,revision,week_start').eq('store_id', storeId).eq('week_start', weekStart).maybeSingle()
  if (scheduleError) throw scheduleError
  if (!schedule) return null
  const { data: entries, error: entriesError } = await api.from('schedule_entries').select('id,employee_id,work_date,day_type,employees(full_name,sector_id,sectors(name)),shift_segments(sequence,starts_at,ends_at)').eq('schedule_id', schedule.id)
  if (entriesError) throw entriesError
  return { schedule, entries: entries ?? [] }
}

export async function validateSchedule(scheduleId: string, expectedRevision: number) {
  const { data, error } = await client().functions.invoke('validate-schedule', { body: { scheduleId, expectedRevision } })
  if (error) throw error
  return data as { validationRunId: string; checksum: string; violations: Array<{ message: string; rule_code: string; blocking: boolean }>; blocking: number }
}

export async function saveCanonicalEntry(input: {
  scheduleId: string
  employeeId: string
  workDate: string
  dayType: 'work' | 'off' | 'vacation' | 'leave' | 'absence'
  segments: Array<{ startsAt: string; endsAt: string }>
  expectedRevision: number
  note?: string
}) {
  const { data, error } = await client().rpc('save_canonical_entry', {
    p_schedule_id: input.scheduleId,
    p_employee_id: input.employeeId,
    p_work_date: input.workDate,
    p_day_type: input.dayType,
    p_segments: input.segments,
    p_expected_revision: input.expectedRevision,
    p_note: input.note ?? null,
  })
  if (error) throw error
  return data as number
}

export async function getStoreTeam(storeId: string) {
  const { data, error } = await client().rpc('list_store_team', { p_store_id: storeId })
  if (error) throw error
  return data ?? []
}

export async function getStoreSectors(storeId: string) {
  const { data, error } = await client().from('sectors').select('id,name').eq('store_id', storeId).order('name')
  if (error) throw error
  return data ?? []
}

export async function inviteStoreMember(input: { storeId: string; email: string; role: 'manager' | 'supervisor' | 'employee'; sectorIds: string[]; canEditSector: boolean }) {
  const { data, error } = await client().functions.invoke('invite-user', { body: input })
  if (error) throw error
  return data
}
