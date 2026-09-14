import type { Shift } from '../data/realSchedule'

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

export const priorWorkStreak = (schedule: Array<Shift | null>, day: number) => {
  let count = 0
  for (let index = day - 1; index >= 0 && schedule[index]; index -= 1) count += 1
  return { count, historyStartsBeforeImport: count === day }
}

export const lastThreeDays = (schedule: Array<Shift | null>, day: number) =>
  [day - 3, day - 2, day - 1].map((index) => index < 0 ? undefined : schedule[index])
