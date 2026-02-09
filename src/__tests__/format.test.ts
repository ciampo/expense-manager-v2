import { describe, it, expect, vi } from 'vitest'
import {
  formatCurrency,
  formatDate,
  parseCurrencyToCents,
  centsToInputValue,
  getTodayISO,
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

describe('formatDate', () => {
  it('formats ISO date to MM/DD/YYYY format', () => {
    expect(formatDate('2024-03-15')).toBe('3/15/2024')
    expect(formatDate('2024-12-01')).toBe('12/1/2024')
  })

  it('handles single digit months and days', () => {
    expect(formatDate('2024-01-05')).toBe('1/5/2024')
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
