import { describe, expect, it } from 'vitest'
import { dailyMinutes, formatMinutes, periodDuration, priorWorkStreak, restMinutes } from './compliance'
import type { Shift } from '../data/realSchedule'

const shift = (start: string, breakStart: string, breakEnd: string, end: string): Shift => ({
  start,
  breakStart,
  breakEnd,
  end,
})

describe('formatMinutes', () => {
  it('formats zero', () => {
    expect(formatMinutes(0)).toBe('0h00')
  })
  it('pads minutes under 10', () => {
    expect(formatMinutes(65)).toBe('1h05')
  })
  it('formats an exact hour', () => {
    expect(formatMinutes(120)).toBe('2h00')
  })
})

describe('periodDuration', () => {
  it('formats the gap between two times', () => {
    expect(periodDuration('07:40', '12:20')).toBe('4h40')
  })
})

describe('dailyMinutes', () => {
  it('sums the two worked segments, excluding the break', () => {
    // 07:40-12:20 (4h40 = 280min) + 14:20-17:40 (3h20 = 200min) = 8h00
    expect(dailyMinutes(shift('07:40', '12:20', '14:20', '17:40'))).toBe(480)
  })
})

describe('restMinutes (interjornada)', () => {
  // Spec's own required test cases (section 23, "Casos de teste essenciais").
  it('22:00 to 09:00 is exactly 11h (660min): at the minimum, not below it', () => {
    const previous = shift('00:00', '00:00', '00:00', '22:00')
    const current = shift('09:00', '00:00', '00:00', '00:00')
    expect(restMinutes(previous, current)).toBe(660)
  })
  it('22:00 to 08:59 is 10h59 (659min): one minute under the minimum', () => {
    const previous = shift('00:00', '00:00', '00:00', '22:00')
    const current = shift('08:59', '00:00', '00:00', '00:00')
    expect(restMinutes(previous, current)).toBe(659)
  })
  it('wraps past midnight when the next shift starts earlier in clock time', () => {
    // Ends at 17:40, starts again at 07:40 the next day: 14h00 of rest.
    const previous = shift('00:00', '00:00', '00:00', '17:40')
    const current = shift('07:40', '00:00', '00:00', '00:00')
    expect(restMinutes(previous, current)).toBe(840)
  })
  it('same clock time in and out is treated as a full 24h rest, not zero', () => {
    const previous = shift('00:00', '00:00', '00:00', '09:00')
    const current = shift('09:00', '00:00', '00:00', '00:00')
    expect(restMinutes(previous, current)).toBe(24 * 60)
  })
})

describe('priorWorkStreak', () => {
  const s = shift('07:40', '12:20', '14:20', '17:40')

  it('counts consecutive worked days immediately before the given date', () => {
    const timeline = new Map<string, Shift | null>([
      ['2026-09-11', s],
      ['2026-09-12', s],
      ['2026-09-13', s],
    ])
    const result = priorWorkStreak(timeline, '2026-09-14')
    expect(result.count).toBe(3)
  })

  it('stops counting at a confirmed day off, without flagging unknown history', () => {
    const timeline = new Map<string, Shift | null>([
      ['2026-09-11', null], // confirmed off
      ['2026-09-12', s],
      ['2026-09-13', s],
    ])
    const result = priorWorkStreak(timeline, '2026-09-14')
    expect(result.count).toBe(2)
    expect(result.historyStartsBeforeImport).toBe(false)
  })

  it('flags unknown history when it runs off the edge of imported data', () => {
    const timeline = new Map<string, Shift | null>([
      ['2026-09-13', s],
      ['2026-09-12', s],
      // 2026-09-11 and earlier were never imported.
    ])
    const result = priorWorkStreak(timeline, '2026-09-14')
    expect(result.count).toBe(2)
    expect(result.historyStartsBeforeImport).toBe(true)
  })

  it('returns zero with no history for an undefined timeline', () => {
    const result = priorWorkStreak(undefined, '2026-09-14')
    expect(result.count).toBe(0)
    expect(result.historyStartsBeforeImport).toBe(true)
  })
})
