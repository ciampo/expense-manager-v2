import { describe, it, expect } from 'vitest'
import { csvEscape, csvRow, CSV_BOM } from '@/lib/csv'

describe('csvEscape', () => {
  it('returns plain values unchanged', () => {
    expect(csvEscape('hello')).toBe('hello')
    expect(csvEscape('12.50')).toBe('12.50')
    expect(csvEscape('')).toBe('')
  })

  it('wraps values containing commas in double quotes', () => {
    expect(csvEscape('Food, Drinks')).toBe('"Food, Drinks"')
  })

  it('wraps values containing double quotes and doubles them', () => {
    expect(csvEscape('say "hello"')).toBe('"say ""hello"""')
  })

  it('wraps values containing newlines', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"')
    expect(csvEscape('line1\rline2')).toBe('"line1\rline2"')
  })

  it('handles values with commas, quotes, and newlines together', () => {
    expect(csvEscape('a "b", c\nd')).toBe('"a ""b"", c\nd"')
  })
})

describe('csvRow', () => {
  it('joins plain fields with commas', () => {
    expect(csvRow(['Date', 'Food', 'Total'])).toBe('Date,Food,Total')
  })

  it('escapes fields that need quoting', () => {
    expect(csvRow(['2026-01-15', 'Food, Drinks', '12.50'])).toBe('2026-01-15,"Food, Drinks",12.50')
  })

  it('handles a single field', () => {
    expect(csvRow(['TOTAL'])).toBe('TOTAL')
  })

  it('handles empty fields', () => {
    expect(csvRow(['', 'a', ''])).toBe(',a,')
  })
})

describe('CSV_BOM', () => {
  it('is the UTF-8 BOM character', () => {
    expect(CSV_BOM).toBe('\uFEFF')
  })
})
