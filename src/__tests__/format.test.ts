import { describe, it, expect, vi } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatDateLong,
  getMonthName,
  parseCurrencyToCents,
  centsToInputValue,
  getTodayISO,
  toISODateString,
  parseLocalDate,
  tryParseLocalDate,
} from '@/lib/format'

describe('formatCurrency', () => {
  it('formats cents to EUR with English locale', () => {
    expect(formatCurrency(1250)).toMatch(/12[,.]50/)
    expect(formatCurrency(1250)).toContain('€')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toMatch(/0[,.]00/)
  })

  it('handles large amounts', () => {
    expect(formatCurrency(1000000)).toMatch(/10[,.]?000[,.]00/)
  })
})

describe('tryParseLocalDate', () => {
  it('returns a Date for valid YYYY-MM-DD input', () => {
    const d = tryParseLocalDate('2024-03-15')
    expect(d).toBeInstanceOf(Date)
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getMonth()).toBe(2)
    expect(d!.getDate()).toBe(15)
  })

  it('returns undefined for malformed input', () => {
    expect(tryParseLocalDate('not-a-date')).toBeUndefined()
    expect(tryParseLocalDate('')).toBeUndefined()
  })

  it('returns undefined for impossible calendar dates', () => {
    expect(tryParseLocalDate('2024-02-30')).toBeUndefined()
    expect(tryParseLocalDate('2024-13-01')).toBeUndefined()
  })
})

describe('formatDate', () => {
  it('formats ISO date to MM/DD/YYYY format', () => {
    expect(formatDate('2024-03-15')).toBe('3/15/2024')
    expect(formatDate('2024-12-01')).toBe('12/1/2024')
  })

  it('handles single digit months and days', () => {
    expect(formatDate('2024-01-05')).toBe('1/5/2024')
  })

  it('returns em dash for invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDate('2024-02-30')).toBe('—')
  })
})

describe('formatDateLong', () => {
  it('formats ISO date with day of week', () => {
    expect(formatDateLong('2024-03-15')).toBe('Friday, March 15, 2024')
  })

  it('returns em dash for invalid dates', () => {
    expect(formatDateLong('not-a-date')).toBe('—')
    expect(formatDateLong('')).toBe('—')
  })

  it('handles first and last day of year', () => {
    expect(formatDateLong('2024-01-01')).toContain('January')
    expect(formatDateLong('2024-12-31')).toContain('December')
  })

  it('handles leap year date', () => {
    const result = formatDateLong('2024-02-29')
    expect(result).toContain('February')
    expect(result).toContain('29')
  })
})

describe('parseCurrencyToCents', () => {
  it('parses decimal with dot', () => {
    expect(parseCurrencyToCents('12.50')).toBe(1250)
  })

  it('parses decimal with comma (European format)', () => {
    expect(parseCurrencyToCents('12,50')).toBe(1250)
  })

  it('parses integer', () => {
    expect(parseCurrencyToCents('12')).toBe(1200)
  })

  it('handles invalid input', () => {
    expect(parseCurrencyToCents('abc')).toBe(0)
    expect(parseCurrencyToCents('')).toBe(0)
  })

  it('rounds to nearest cent', () => {
    expect(parseCurrencyToCents('12.555')).toBe(1256)
  })

  it('handles multiple commas (European thousands + decimal)', () => {
    expect(parseCurrencyToCents('1,234,56')).toBe(123456)
  })

  it('parses European thousands and decimal separators', () => {
    expect(parseCurrencyToCents('1.234,56')).toBe(123456)
  })

  it('parses US thousands and decimal separators', () => {
    expect(parseCurrencyToCents('1,234.56')).toBe(123456)
  })

  it('treats single separator as decimal even with 3 trailing digits', () => {
    expect(parseCurrencyToCents('1.234')).toBe(123)
    expect(parseCurrencyToCents('1,234')).toBe(123)
  })

  it('parses multiple thousands groups without decimals', () => {
    expect(parseCurrencyToCents('1,234,567')).toBe(123456700)
  })

  it('parses multiple thousands groups with decimals', () => {
    expect(parseCurrencyToCents('1,234,567.89')).toBe(123456789)
  })

  it('parses sub-unit amounts', () => {
    expect(parseCurrencyToCents('0.99')).toBe(99)
    expect(parseCurrencyToCents('0,99')).toBe(99)
  })

  it('parses single-digit decimal', () => {
    expect(parseCurrencyToCents('5.5')).toBe(550)
    expect(parseCurrencyToCents('5,5')).toBe(550)
  })

  it('strips whitespace and non-numeric characters', () => {
    expect(parseCurrencyToCents(' 12.50 ')).toBe(1250)
    expect(parseCurrencyToCents('1,234,56 ')).toBe(123456)
    expect(parseCurrencyToCents(' 1.234,56')).toBe(123456)
    expect(parseCurrencyToCents('1.234,56 €')).toBe(123456)
    expect(parseCurrencyToCents('€12.50')).toBe(1250)
    expect(parseCurrencyToCents('$1,234.56')).toBe(123456)
  })

  it('preserves leading sign', () => {
    expect(parseCurrencyToCents('-12.50')).toBe(-1250)
    expect(parseCurrencyToCents('-12,50')).toBe(-1250)
    expect(parseCurrencyToCents('-€12.50')).toBe(-1250)
    expect(parseCurrencyToCents('+12.50')).toBe(1250)
  })
})

describe('centsToInputValue', () => {
  it('converts cents to decimal string', () => {
    expect(centsToInputValue(1250)).toBe('12.50')
  })

  it('handles zero', () => {
    expect(centsToInputValue(0)).toBe('0.00')
  })

  it('handles large amounts', () => {
    expect(centsToInputValue(1000000)).toBe('10000.00')
  })
})

describe('getTodayISO', () => {
  it('returns ISO date string format', () => {
    const result = getTodayISO()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns local date, not UTC date', () => {
    // Pin time to avoid flakiness if the date rolls over at midnight
    // between getTodayISO() and the reference Date construction.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 15, 23, 59, 50)) // Jun 15 2026, 23:59:50 local

    const result = getTodayISO()
    expect(result).toBe('2026-06-15')

    vi.useRealTimers()
  })
})

describe('toISODateString', () => {
  it('formats a Date to YYYY-MM-DD using local components', () => {
    expect(toISODateString(new Date(2024, 0, 5))).toBe('2024-01-05')
    expect(toISODateString(new Date(2024, 11, 25))).toBe('2024-12-25')
  })

  it('zero-pads single-digit months and days', () => {
    expect(toISODateString(new Date(2024, 2, 3))).toBe('2024-03-03')
  })

  it('roundtrips with parseLocalDate', () => {
    const iso = '2026-06-15'
    const parsed = parseLocalDate(iso)
    expect(toISODateString(parsed)).toBe(iso)
  })
})

describe('parseLocalDate', () => {
  it('parses YYYY-MM-DD as local midnight', () => {
    const date = parseLocalDate('2024-03-15')
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(15)
  })

  it('returns Invalid Date for malformed input', () => {
    expect(parseLocalDate('not-a-date').getTime()).toBeNaN()
    expect(parseLocalDate('2024/03/15').getTime()).toBeNaN()
    expect(parseLocalDate('').getTime()).toBeNaN()
  })

  it('returns Invalid Date for impossible calendar dates', () => {
    expect(parseLocalDate('2024-02-30').getTime()).toBeNaN()
    expect(parseLocalDate('2024-13-01').getTime()).toBeNaN()
    expect(parseLocalDate('2024-00-15').getTime()).toBeNaN()
  })

  it('does not shift dates in non-UTC timezones', () => {
    const date = parseLocalDate('2024-01-01')
    expect(date.getFullYear()).toBe(2024)
    expect(date.getMonth()).toBe(0)
    expect(date.getDate()).toBe(1)
  })
})

describe('formatDate timezone stability', () => {
  it('formats 2024-03-15 consistently regardless of timezone interpretation', () => {
    const result = formatDate('2024-03-15')
    // Must contain "15" as the day -- if parsed as UTC midnight, negative
    // UTC offsets would shift to March 14
    expect(result).toContain('15')
  })

  it('formats 2024-01-01 as January 1, not December 31', () => {
    const result = formatDate('2024-01-01')
    // new Date('2024-01-01') is UTC midnight; in UTC-5 that's Dec 31 23:00
    expect(result).toContain('1/1/2024')
  })
})

describe('getMonthName', () => {
  it('returns full month name with year for all 12 months', () => {
    const expected = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]
    for (let m = 1; m <= 12; m++) {
      const result = getMonthName(m, 2026)
      expect(result).toContain(expected[m - 1])
      expect(result).toContain('2026')
    }
  })
})
