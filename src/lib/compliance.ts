import type { Shift } from '../data/realSchedule'
import { addDays } from './dates'

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export const formatMinutes = (value: number) => `${Math.floor(value / 60)}h${String(value % 60).padStart(2, '0')}`
export const periodDuration = (start: string, end: string) => formatMinutes(toMinutes(end) - toMinutes(start))
export const dailyMinutes = (shift: Shift) =>
  (toMinutes(shift.breakStart) - toMinutes(shift.start)) + (toMinutes(shift.end) - toMinutes(shift.breakEnd))

// previous is always the calendar day immediately before current (see the one call site in
// ScheduleWorkspace, which looks it up via addDays(currentIso, -1)), so the gap is always a full
// day minus previous's end-of-shift clock time plus current's start-of-shift clock time — never
// gated by whether the naive same-day subtraction happens to be negative. The old `difference >=
// 0 ? difference : ...` branch under-reported rest (as little as the same-day gap, sometimes near
// zero) whenever a shift started later in clock time than the previous day's shift ended, e.g.
// finishing at 12:00 one day and starting at 14:00 the next — 26h of real rest reported as 2h.
export const restMinutes = (previous: Shift, current: Shift) =>
  24 * 60 - toMinutes(previous.end) + toMinutes(current.start)

// timeline maps an ISO date to that employee's shift (null = confirmed day off). A date missing
// from the map means we have no record for it (never imported), which is different from a
// confirmed day off and stops the streak count without claiming to know what happened before it.
export const priorWorkStreak = (timeline: Map<string, Shift | null> | undefined, iso: string) => {
  let count = 0
  let cursor = addDays(iso, -1)
  while (timeline?.has(cursor)) {
    const shift = timeline.get(cursor)
    if (!shift) break
    count += 1
    cursor = addDays(cursor, -1)
  }
  return { count, historyStartsBeforeImport: !timeline?.has(cursor) }
}
