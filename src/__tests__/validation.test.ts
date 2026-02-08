import { describe, it, expect } from 'vitest'
import { isValidDate, validateExpenseFields } from '../../convex/validation'

// ---------------------------------------------------------------------------
// isValidDate
// ---------------------------------------------------------------------------

describe('isValidDate', () => {
  it('accepts valid dates', () => {
    expect(isValidDate('2026-01-01')).toBe(true)
    expect(isValidDate('2026-12-31')).toBe(true)
    expect(isValidDate('2024-02-29')).toBe(true) // leap year
    expect(isValidDate('2000-02-29')).toBe(true) // century leap year
  })

  it('rejects logically invalid dates', () => {
    expect(isValidDate('2026-02-30')).toBe(false) // Feb has 28 days in 2026
    expect(isValidDate('2026-04-31')).toBe(false) // Apr has 30 days
    expect(isValidDate('2025-02-29')).toBe(false) // not a leap year
    expect(isValidDate('2026-13-01')).toBe(false) // month 13
    expect(isValidDate('2026-00-01')).toBe(false) // month 0
    expect(isValidDate('2026-01-00')).toBe(false) // day 0
    expect(isValidDate('2026-01-32')).toBe(false) // day 32
  })

  it('rejects malformed strings', () => {
    expect(isValidDate('')).toBe(false)
    expect(isValidDate('not-a-date')).toBe(false)
    expect(isValidDate('2026/01/15')).toBe(false)
    expect(isValidDate('01-15-2026')).toBe(false)
    expect(isValidDate('2026-1-5')).toBe(false) // single-digit month/day
    expect(isValidDate('2026-01-15T00:00:00Z')).toBe(false) // ISO datetime
  })
})

// ---------------------------------------------------------------------------
// validateExpenseFields
// ---------------------------------------------------------------------------

describe('validateExpenseFields', () => {
  const valid = {
    date: '2026-03-15',
    merchant: 'Coffee Shop',
    amount: 450,
  }

  // -- date -----------------------------------------------------------------

  it('accepts a valid date', () => {
    expect(() => validateExpenseFields(valid)).not.toThrow()
  })

  it('rejects an invalid date', () => {
    expect(() =>
      validateExpenseFields({ ...valid, date: '2026-02-30' }),
    ).toThrow('Invalid date')
  })

  it('rejects a malformed date', () => {
    expect(() =>
      validateExpenseFields({ ...valid, date: 'not-a-date' }),
    ).toThrow('Invalid date')
  })

  // -- amount ---------------------------------------------------------------

  it('accepts a positive integer amount', () => {
    expect(() =>
      validateExpenseFields({ ...valid, amount: 1 }),
    ).not.toThrow()
  })

  it('rejects zero amount', () => {
    expect(() =>
      validateExpenseFields({ ...valid, amount: 0 }),
    ).toThrow('positive integer')
  })

  it('rejects negative amount', () => {
    expect(() =>
      validateExpenseFields({ ...valid, amount: -100 }),
    ).toThrow('positive integer')
  })

  it('rejects non-integer amount', () => {
    expect(() =>
      validateExpenseFields({ ...valid, amount: 12.34 }),
    ).toThrow('positive integer')
  })

  it('rejects NaN amount', () => {
    expect(() =>
      validateExpenseFields({ ...valid, amount: NaN }),
    ).toThrow('positive integer')
  })

  it('rejects Infinity amount', () => {
    expect(() =>
      validateExpenseFields({ ...valid, amount: Infinity }),
    ).toThrow('positive integer')
  })

  // -- merchant -------------------------------------------------------------

  it('accepts a valid merchant name', () => {
    expect(() => validateExpenseFields(valid)).not.toThrow()
  })

  it('rejects empty merchant', () => {
    expect(() =>
      validateExpenseFields({ ...valid, merchant: '' }),
    ).toThrow('required')
  })

  it('rejects whitespace-only merchant', () => {
    expect(() =>
      validateExpenseFields({ ...valid, merchant: '   ' }),
    ).toThrow('required')
  })

  it('rejects merchant over 200 characters', () => {
    expect(() =>
      validateExpenseFields({ ...valid, merchant: 'A'.repeat(201) }),
    ).toThrow('200 characters')
  })

  it('accepts merchant at exactly 200 characters', () => {
    expect(() =>
      validateExpenseFields({ ...valid, merchant: 'A'.repeat(200) }),
    ).not.toThrow()
  })

  it('checks length on trimmed merchant', () => {
    // 200 chars of content + surrounding whitespace should pass
    const padded = '  ' + 'A'.repeat(200) + '  '
    expect(() =>
      validateExpenseFields({ ...valid, merchant: padded }),
    ).not.toThrow()
  })

  // -- comment (optional) ---------------------------------------------------

  it('accepts missing comment', () => {
    expect(() => validateExpenseFields(valid)).not.toThrow()
  })

  it('accepts undefined comment', () => {
    expect(() =>
      validateExpenseFields({ ...valid, comment: undefined }),
    ).not.toThrow()
  })

  it('accepts a short comment', () => {
    expect(() =>
      validateExpenseFields({ ...valid, comment: 'Quick note' }),
    ).not.toThrow()
  })

  it('accepts comment at exactly 1000 characters', () => {
    expect(() =>
      validateExpenseFields({ ...valid, comment: 'A'.repeat(1000) }),
    ).not.toThrow()
  })

  it('rejects comment over 1000 characters', () => {
    expect(() =>
      validateExpenseFields({ ...valid, comment: 'A'.repeat(1001) }),
    ).toThrow('1000 characters')
  })

  it('checks length on trimmed comment', () => {
    // 1000 chars of content + surrounding whitespace should pass
    const padded = '  ' + 'A'.repeat(1000) + '  '
    expect(() =>
      validateExpenseFields({ ...valid, comment: padded }),
    ).not.toThrow()
  })

  it('rejects whitespace-padded comment over 1000 chars of content', () => {
    const padded = '  ' + 'A'.repeat(1001) + '  '
    expect(() =>
      validateExpenseFields({ ...valid, comment: padded }),
    ).toThrow('1000 characters')
  })
})
