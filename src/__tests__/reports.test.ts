import { describe, it, expect } from 'vitest'
import { distinctMonthsFromDates } from '../../convex/reports'

describe('distinctMonthsFromDates', () => {
  it('returns empty array for empty input', () => {
    expect(distinctMonthsFromDates([])).toEqual([])
  })

  it('extracts a single month from a single date', () => {
    expect(distinctMonthsFromDates(['2026-03-15'])).toEqual([{ year: 2026, month: 3 }])
  })

  it('deduplicates dates within the same month', () => {
    const dates = ['2026-03-01', '2026-03-15', '2026-03-31']
    expect(distinctMonthsFromDates(dates)).toEqual([{ year: 2026, month: 3 }])
  })

  it('returns months sorted newest first', () => {
    const dates = ['2025-01-10', '2026-06-01', '2025-12-25']
    expect(distinctMonthsFromDates(dates)).toEqual([
      { year: 2026, month: 6 },
      { year: 2025, month: 12 },
      { year: 2025, month: 1 },
    ])
  })

  it('handles dates spanning multiple years', () => {
    const dates = ['2024-11-05', '2025-02-14', '2026-01-01']
    expect(distinctMonthsFromDates(dates)).toEqual([
      { year: 2026, month: 1 },
      { year: 2025, month: 2 },
      { year: 2024, month: 11 },
    ])
  })

  it('handles many expenses in random order', () => {
    const dates = [
      '2025-06-01',
      '2025-03-15',
      '2025-06-20',
      '2025-01-10',
      '2025-03-01',
      '2025-06-30',
      '2025-01-31',
    ]
    expect(distinctMonthsFromDates(dates)).toEqual([
      { year: 2025, month: 6 },
      { year: 2025, month: 3 },
      { year: 2025, month: 1 },
    ])
  })

  it('treats month numbers as numeric (not lexicographic)', () => {
    const dates = ['2025-02-01', '2025-11-01']
    const result = distinctMonthsFromDates(dates)
    expect(result[0]).toEqual({ year: 2025, month: 11 })
    expect(result[1]).toEqual({ year: 2025, month: 2 })
  })
})
