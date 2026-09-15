import { supabase } from './supabase'
import { employees } from '../data/realSchedule'
import { addDays } from './dates'

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

// idempotencyKey should be generated once per publish attempt and reused across retries of that
// same attempt, otherwise a network retry with a fresh random key would create a duplicate
// publication instead of being recognized as the same request.
export async function publishWeek(scheduleId: string, expectedRevision: number, idempotencyKey: string) {
  const { data, error } = await client().rpc('publish_canonical_schedule', {
    p_schedule_id: scheduleId,
    p_expected_revision: expectedRevision,
    p_idempotency_key: idempotencyKey,
  })
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

export async function getStoreEmployees(storeId: string) {
  const { data, error } = await client()
    .from('employees')
    .select('id,full_name,sector_id,sectors(name)')
    .eq('store_id', storeId)
    .eq('active', true)
    .order('full_name')
  if (error) throw error
  return data ?? []
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

export type ComplianceEntryRow = {
  employee_id: string
  work_date: string
  day_type: string
  shift_segments: Array<{ sequence: number; starts_at: string; ends_at: string }>
}

// Same window the validate-schedule Edge Function uses (21 days back, 13 days forward), so the
// client's advisory pre-check and the server's authoritative validation see the same history.
export async function loadComplianceContext(storeId: string, weekStart: string) {
  const start = addDays(weekStart, -21)
  const end = addDays(weekStart, 13)
  const { data, error } = await client()
    .from('schedule_entries')
    .select('employee_id,work_date,day_type,schedules!inner(store_id),shift_segments(sequence,starts_at,ends_at)')
    .eq('schedules.store_id', storeId)
    .gte('work_date', start)
    .lte('work_date', end)
  if (error) throw error
  return (data ?? []) as unknown as ComplianceEntryRow[]
}

async function findLatestValidationRun(storeId: string, weekStart: string) {
  const api = client()
  const { data: schedule, error: scheduleError } = await api
    .from('schedules')
    .select('id,revision,status')
    .eq('store_id', storeId)
    .eq('week_start', weekStart)
    .maybeSingle()
  if (scheduleError) throw scheduleError
  if (!schedule) return { schedule: null, run: null }
  const { data: run, error: runError } = await api
    .from('validation_runs')
    .select('id,status,completed_at')
    .eq('schedule_id', schedule.id)
    .eq('schedule_revision', schedule.revision)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (runError) throw runError
  return { schedule, run }
}

// Real numbers for the dashboard, sourced from the authoritative server-side validation
// (validation_runs/violations) instead of a client-side re-derivation of the same rules.
export async function loadValidationSummary(storeId: string, weekStart: string) {
  const { schedule, run } = await findLatestValidationRun(storeId, weekStart)
  if (!schedule) return null
  if (!run) return { schedule, run: null, critical: 0, warnings: 0 }
  const { data: violations, error: violationsError } = await client()
    .from('violations')
    .select('severity')
    .eq('validation_run_id', run.id)
    .is('resolved_at', null)
  if (violationsError) throw violationsError
  const critical = (violations ?? []).filter((v) => v.severity === 'critical').length
  const warnings = (violations ?? []).filter((v) => v.severity !== 'critical').length
  return { schedule, run, critical, warnings }
}

export type ViolationRow = {
  id: string
  rule_code: string
  severity: 'info' | 'warning' | 'critical'
  blocking: boolean
  message: string
  evidence: Record<string, unknown>
  resolved_at: string | null
  resolution_note: string | null
  employee_id: string | null
  employees: { full_name: string } | { full_name: string }[] | null
  schedule_entries: { work_date: string } | { work_date: string }[] | null
}

// Full violation list for the Central de conflitos screen, tied to the latest validation run
// for the schedule currently displayed (same revision the editor and the dashboard show).
export async function loadViolationsForWeek(storeId: string, weekStart: string) {
  const { schedule, run } = await findLatestValidationRun(storeId, weekStart)
  if (!schedule || !run) return { schedule, run: null, violations: [] as ViolationRow[] }
  const { data, error } = await client()
    .from('violations')
    .select(
      'id,rule_code,severity,blocking,message,evidence,resolved_at,resolution_note,employee_id,employees(full_name),schedule_entries(work_date)',
    )
    .eq('validation_run_id', run.id)
    .order('severity', { ascending: true })
  if (error) throw error
  return { schedule, run, violations: (data ?? []) as unknown as ViolationRow[] }
}

// Summary for the Publicações wizard: same schedule/validation data as the dashboard, plus who
// and which sectors are covered, so the "resumo da publicação" step doesn't lie about scope.
export async function loadPublicationSummary(storeId: string, weekStart: string) {
  const summary = await loadValidationSummary(storeId, weekStart)
  if (!summary) return null
  const { schedule, run, critical, warnings } = summary
  const { data: entries, error: entriesError } = await client()
    .from('schedule_entries')
    .select('employee_id,day_type,employees(sectors(name))')
    .eq('schedule_id', schedule.id)
  if (entriesError) throw entriesError
  const employeeIds = new Set((entries ?? []).map((entry) => entry.employee_id))
  const sectorNames = new Set<string>()
  for (const entry of entries ?? []) {
    const employeeValue = entry.employees as unknown as
      | { sectors?: { name?: string } | { name?: string }[] }
      | { sectors?: { name?: string } | { name?: string }[] }[]
      | null
    const employee = Array.isArray(employeeValue) ? employeeValue[0] : employeeValue
    const sectorValue = employee?.sectors
    const name = Array.isArray(sectorValue) ? sectorValue[0]?.name : sectorValue?.name
    if (name) sectorNames.add(name)
  }
  return { schedule, people: employeeIds.size, sectors: [...sectorNames], run, critical, warnings }
}

export async function submitScheduleForApproval(scheduleId: string, expectedRevision: number) {
  const { data, error } = await client().rpc('submit_schedule_for_approval', {
    p_schedule_id: scheduleId,
    p_expected_revision: expectedRevision,
  })
  if (error) throw error
  return data as number
}

export async function decideScheduleApproval(
  scheduleId: string,
  expectedRevision: number,
  decision: 'approved' | 'rejected',
  reason?: string,
) {
  const { data, error } = await client().rpc('decide_schedule_approval', {
    p_schedule_id: scheduleId,
    p_expected_revision: expectedRevision,
    p_decision: decision,
    p_reason: reason ?? null,
  })
  if (error) throw error
  return data as number
}

export async function resolveViolation(violationId: string, note: string) {
  const { error } = await client().rpc('resolve_violation', { p_violation_id: violationId, p_note: note })
  if (error) throw error
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

export type RuleRow = {
  id: string
  code: string
  severity: 'info' | 'warning' | 'critical'
  blocking: boolean
  parameters: Record<string, number>
  legal_basis: string | null
}
export type RuleSetRow = {
  id: string
  name: string
  version: number
  effective_from: string
  effective_to: string | null
}

// rule_sets are scoped by organization, not store, so this resolves the store's organization
// first. The "active" set is the one with no effective_to (open-ended); if every version has
// been closed out (shouldn't normally happen) it falls back to the most recent one.
export async function loadRuleSets(storeId: string) {
  const { data: store, error: storeError } = await client()
    .from('stores')
    .select('organization_id')
    .eq('id', storeId)
    .single()
  if (storeError) throw storeError
  const { data: ruleSets, error: ruleSetsError } = await client()
    .from('rule_sets')
    .select('id,name,version,effective_from,effective_to')
    .eq('organization_id', store.organization_id)
    .order('effective_from', { ascending: false })
  if (ruleSetsError) throw ruleSetsError
  const rows = (ruleSets ?? []) as RuleSetRow[]
  const active = rows.find((rs) => !rs.effective_to) ?? rows[0] ?? null
  let rules: RuleRow[] = []
  if (active) {
    const { data, error } = await client()
      .from('rules')
      .select('id,code,severity,blocking,parameters,legal_basis')
      .eq('rule_set_id', active.id)
      .order('code')
    if (error) throw error
    rules = (data ?? []) as RuleRow[]
  }
  return { organizationId: store.organization_id as string, ruleSets: rows, active, rules }
}

export type RuleRevisionInput = {
  code: string
  severity: 'info' | 'warning' | 'critical'
  blocking: boolean
  parameters: Record<string, number>
  legal_basis: string | null
}

export async function createRuleSetRevision(ruleSetId: string, effectiveFrom: string, rules: RuleRevisionInput[]) {
  const { data, error } = await client().rpc('create_rule_set_revision', {
    p_rule_set_id: ruleSetId,
    p_effective_from: effectiveFrom,
    p_rules: rules,
  })
  if (error) throw error
  return data as string
}

// So the schedule grid's advisory coloring (interjornada, streak) reflects whatever the
// organization configured on the Regras screen instead of hardcoded defaults, for the rule set
// actually in effect on the displayed week (not just whichever one is active today).
export async function loadRuleParametersForWeek(storeId: string, weekStart: string) {
  const { data: store, error: storeError } = await client()
    .from('stores')
    .select('organization_id')
    .eq('id', storeId)
    .single()
  if (storeError) throw storeError
  const { data: ruleSets, error: ruleSetsError } = await client()
    .from('rule_sets')
    .select('id,effective_from,effective_to')
    .eq('organization_id', store.organization_id)
    .order('effective_from', { ascending: false })
  if (ruleSetsError) throw ruleSetsError
  const applicable = (ruleSets ?? []).find(
    (rs) => rs.effective_from <= weekStart && (!rs.effective_to || rs.effective_to >= weekStart),
  )
  if (!applicable) return {} as Record<string, Record<string, number>>
  const { data: rules, error: rulesError } = await client()
    .from('rules')
    .select('code,parameters')
    .eq('rule_set_id', applicable.id)
  if (rulesError) throw rulesError
  return Object.fromEntries(
    (rules ?? []).map((rule) => [rule.code, rule.parameters as Record<string, number>]),
  ) as Record<string, Record<string, number>>
}
