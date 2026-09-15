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

export const restMinutes = (previous: Shift, current: Shift) => {
  const difference = toMinutes(current.start) - toMinutes(previous.end)
  return difference >= 0 ? difference : difference + 24 * 60
}

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
