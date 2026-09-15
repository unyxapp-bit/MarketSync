import { describe, expect, it } from 'vitest'
import {
  addDays,
  addDaysToTimestamp,
  addMonths,
  daysInMonth,
  mondayOf,
  monthDates,
  monthLabel,
  startOfMonth,
  weekDates,
  weekRangeLabel,
  weekdayShort,
} from './dates'

describe('addDays', () => {
  it('adds days within the same month', () => {
    expect(addDays('2026-09-14', 1)).toBe('2026-09-15')
  })
  it('subtracts days across a month boundary', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })
  it('adds days across a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('crosses a DST transition without rolling the calendar day (noon-UTC anchoring)', () => {
    // Brazil no longer observes DST, but the noon-UTC anchor is what protects this generally:
    // a date-only value should never shift by a day no matter what timezone math touches it.
    expect(addDays('2026-11-01', 7)).toBe('2026-11-08')
  })
  it('is reversible', () => {
    expect(addDays(addDays('2026-09-14', 10), -10)).toBe('2026-09-14')
  })
})

describe('addDaysToTimestamp', () => {
  it('shifts a UTC timestamp forward, preserving the time of day', () => {
    expect(addDaysToTimestamp('2026-09-14T10:40:00.000Z', 7)).toBe('2026-09-21T10:40:00.000Z')
  })
  it('preserves the time of day when the offset is not UTC', () => {
    expect(addDaysToTimestamp('2026-09-14T07:40:00-03:00', 7)).toBe('2026-09-21T10:40:00.000Z')
  })
  it('crosses a month boundary', () => {
    expect(addDaysToTimestamp('2026-09-28T12:00:00.000Z', 7)).toBe('2026-10-05T12:00:00.000Z')
  })
})

describe('mondayOf', () => {
  it('returns the same date when already a Monday', () => {
    expect(mondayOf('2026-09-14')).toBe('2026-09-14') // known Monday
  })
  it('goes back to Monday from a mid-week day', () => {
    expect(mondayOf('2026-09-17')).toBe('2026-09-14') // Thursday
  })
  it('goes back to Monday from a Sunday (largest offset, 6 days)', () => {
    expect(mondayOf('2026-09-20')).toBe('2026-09-14') // Sunday
  })
  it('goes back to Monday from a Saturday', () => {
    expect(mondayOf('2026-09-19')).toBe('2026-09-14') // Saturday
  })
})

describe('weekDates', () => {
  it('returns 7 consecutive days starting at weekStart', () => {
    const days = weekDates('2026-09-14')
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.iso)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ])
  })
  it('labels Monday and Sunday correctly (no -feira suffix on weekend days)', () => {
    const days = weekDates('2026-09-14')
    expect(days[0].weekday).toBe('Seg')
    expect(days[0].label).toBe('Segunda-feira, 14 de setembro de 2026')
    expect(days[6].weekday).toBe('Dom')
    expect(days[6].label).toBe('Domingo, 20 de setembro de 2026')
    expect(days[5].label).toBe('Sábado, 19 de setembro de 2026')
  })
  it('pads single-digit day numbers', () => {
    const days = weekDates('2026-09-07')
    expect(days[0].date).toBe('07')
  })
})

describe('weekdayShort', () => {
  it('matches the corresponding entry from weekDates', () => {
    expect(weekdayShort('2026-09-20')).toBe('Dom')
    expect(weekdayShort('2026-09-14')).toBe('Seg')
  })
})

describe('startOfMonth', () => {
  it('returns the 1st regardless of the input day', () => {
    expect(startOfMonth('2026-09-17')).toBe('2026-09-01')
    expect(startOfMonth('2026-09-01')).toBe('2026-09-01')
  })
})

describe('daysInMonth', () => {
  it('counts a 30-day month', () => {
    expect(daysInMonth('2026-09-05')).toBe(30)
  })
  it('counts a 31-day month', () => {
    expect(daysInMonth('2026-10-05')).toBe(31)
  })
  it('counts February in a non-leap year', () => {
    expect(daysInMonth('2026-02-05')).toBe(28)
  })
  it('counts February in a leap year', () => {
    expect(daysInMonth('2028-02-05')).toBe(29)
  })
})

describe('addMonths', () => {
  // Used for month-to-month navigation, so it always anchors to the 1st of the target month
  // (like startOfMonth) rather than preserving the input day-of-month.
  it('anchors to the 1st of the next month, regardless of the input day', () => {
    expect(addMonths('2026-09-14', 1)).toBe('2026-10-01')
  })
  it('crosses a year boundary', () => {
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
  })
  it('goes backwards', () => {
    expect(addMonths('2026-09-01', -1)).toBe('2026-08-01')
  })
})

describe('monthDates', () => {
  it('returns one entry per day of the month, starting on the 1st', () => {
    const days = monthDates('2026-09-17')
    expect(days).toHaveLength(30)
    expect(days[0].iso).toBe('2026-09-01')
    expect(days[29].iso).toBe('2026-09-30')
  })
})

describe('monthLabel', () => {
  it('formats a capitalized month name and year', () => {
    expect(monthLabel('2026-09-17')).toBe('Setembro de 2026')
  })
})

describe('weekRangeLabel', () => {
  it('formats a week within a single month', () => {
    expect(weekRangeLabel('2026-09-14')).toBe('14 a 20 de setembro de 2026')
  })
  it('formats a week spanning two months', () => {
    // 2026-09-28 is a Monday; the week runs into October.
    expect(weekRangeLabel('2026-09-28')).toBe('28 de setembro a 04 de outubro de 2026')
  })
})
