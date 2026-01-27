import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatDate,
  parseCurrencyToCents,
  centsToInputValue,
  getTodayISO,
} from '@/lib/format'

describe('formatCurrency', () => {
  it('formats cents to EUR with Italian locale', () => {
    expect(formatCurrency(1250)).toMatch(/12[,.]50/)
    expect(formatCurrency(1250)).toContain('€')
  })

  it('handles zero', () => {
    expect(formatCurrency(0)).toMatch(/0[,.]00/)
  })

  it('handles large amounts', () => {
    expect(formatCurrency(1000000)).toMatch(/10[.]?000[,.]00/)
  })
})

describe('formatDate', () => {
  it('formats ISO date to Italian locale (DD/MM/YYYY)', () => {
    const result = formatDate('2024-03-15')
    expect(result).toContain('15')
    expect(result).toContain('3') // March
    expect(result).toContain('2024')
  })
})

describe('parseCurrencyToCents', () => {
  it('parses decimal with dot', () => {
    expect(parseCurrencyToCents('12.50')).toBe(1250)
  })

  it('parses decimal with comma (Italian format)', () => {
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
})
