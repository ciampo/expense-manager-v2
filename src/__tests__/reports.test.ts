import { describe, it, expect } from 'vitest'
import { distinctMonthsFromDates, validateYearMonth } from '../../convex/reports'

describe('validateYearMonth', () => {
  it('accepts valid year and month values', () => {
    expect(() => validateYearMonth(2026, 1)).not.toThrow()
    expect(() => validateYearMonth(2026, 6)).not.toThrow()
    expect(() => validateYearMonth(2026, 12)).not.toThrow()
    expect(() => validateYearMonth(2000, 1)).not.toThrow()
    expect(() => validateYearMonth(2100, 12)).not.toThrow()
  })

  it('rejects month below 1', () => {
    expect(() => validateYearMonth(2026, 0)).toThrow(
      'Invalid month: 0. Must be an integer between 1 and 12.',
    )
    expect(() => validateYearMonth(2026, -1)).toThrow(
      'Invalid month: -1. Must be an integer between 1 and 12.',
    )
  })

  it('rejects month above 12', () => {
    expect(() => validateYearMonth(2026, 13)).toThrow(
      'Invalid month: 13. Must be an integer between 1 and 12.',
    )
    expect(() => validateYearMonth(2026, 99)).toThrow(
      'Invalid month: 99. Must be an integer between 1 and 12.',
    )
  })

  it('rejects non-integer month', () => {
    expect(() => validateYearMonth(2026, 1.5)).toThrow(
      'Invalid month: 1.5. Must be an integer between 1 and 12.',
    )
  })

  it('rejects year below 2000', () => {
    expect(() => validateYearMonth(1999, 6)).toThrow(
      'Invalid year: 1999. Must be an integer between 2000 and 2100.',
    )
  })

  it('rejects year above 2100', () => {
    expect(() => validateYearMonth(2101, 6)).toThrow(
      'Invalid year: 2101. Must be an integer between 2000 and 2100.',
    )
  })

  it('rejects non-integer year', () => {
    expect(() => validateYearMonth(2026.5, 6)).toThrow(
      'Invalid year: 2026.5. Must be an integer between 2000 and 2100.',
    )
  })
})

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
