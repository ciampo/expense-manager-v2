import { describe, it, expect } from 'vitest'
import {
  expenseDateSchema,
  expenseAmountSchema,
  expenseMerchantSchema,
  expenseCommentSchema,
  expenseSchema,
  categoryNameSchema,
  categoryIconSchema,
  emailSchema,
  passwordSchema,
} from '@/lib/schemas'

function expectSuccess(schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown } }, value: unknown) {
  const result = schema.safeParse(value)
  expect(result.success).toBe(true)
  return result
}

function expectFailure(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ message: string }> } } }, value: unknown) {
  const result = schema.safeParse(value)
  expect(result.success).toBe(false)
  return result
}

function getErrorMessages(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ message: string }> } } }, value: unknown): string[] {
  const result = schema.safeParse(value)
  if (result.success) return []
  return result.error!.issues.map((i) => i.message)
}

// ---------------------------------------------------------------------------
// expenseDateSchema
// ---------------------------------------------------------------------------

describe('expenseDateSchema', () => {
  it('accepts valid YYYY-MM-DD dates', () => {
    expectSuccess(expenseDateSchema, '2026-01-01')
    expectSuccess(expenseDateSchema, '2026-12-31')
    expectSuccess(expenseDateSchema, '2024-02-29') // leap year
  })

  it('rejects logically invalid dates', () => {
    expectFailure(expenseDateSchema, '2026-02-30')
    expectFailure(expenseDateSchema, '2025-02-29') // not a leap year
    expectFailure(expenseDateSchema, '2026-13-01')
    expectFailure(expenseDateSchema, '2026-00-01')
  })

  it('rejects malformed date strings', () => {
    expectFailure(expenseDateSchema, '')
    expectFailure(expenseDateSchema, 'not-a-date')
    expectFailure(expenseDateSchema, '2026/01/15')
    expectFailure(expenseDateSchema, '2026-1-5')
  })

  it('returns a descriptive error message', () => {
    const messages = getErrorMessages(expenseDateSchema, 'bad')
    expect(messages).toContain('Invalid date. Expected a valid YYYY-MM-DD date.')
  })
})

// ---------------------------------------------------------------------------
// expenseAmountSchema
// ---------------------------------------------------------------------------

describe('expenseAmountSchema', () => {
  it('accepts positive integers', () => {
    expectSuccess(expenseAmountSchema, 1)
    expectSuccess(expenseAmountSchema, 100)
    expectSuccess(expenseAmountSchema, 999999)
  })

  it('rejects zero', () => {
    expectFailure(expenseAmountSchema, 0)
  })

  it('rejects negative numbers', () => {
    expectFailure(expenseAmountSchema, -1)
    expectFailure(expenseAmountSchema, -100)
  })

  it('rejects non-integer numbers', () => {
    expectFailure(expenseAmountSchema, 1.5)
    expectFailure(expenseAmountSchema, 0.99)
  })

  it('provides specific error messages', () => {
    expect(getErrorMessages(expenseAmountSchema, 0)).toEqual(
      expect.arrayContaining([expect.stringContaining('positive')]),
    )
    expect(getErrorMessages(expenseAmountSchema, 1.5)).toEqual(
      expect.arrayContaining([expect.stringContaining('whole number')]),
    )
  })
})

// ---------------------------------------------------------------------------
// expenseMerchantSchema
// ---------------------------------------------------------------------------

describe('expenseMerchantSchema', () => {
  it('accepts a valid merchant name', () => {
    const result = expectSuccess(expenseMerchantSchema, 'Coffee Shop')
    expect(result.data).toBe('Coffee Shop')
  })

  it('trims whitespace and returns trimmed value', () => {
    const result = expectSuccess(expenseMerchantSchema, '  Coffee Shop  ')
    expect(result.data).toBe('Coffee Shop')
  })

  it('rejects empty string', () => {
    expectFailure(expenseMerchantSchema, '')
  })

  it('rejects whitespace-only string', () => {
    expectFailure(expenseMerchantSchema, '   ')
  })

  it('accepts name at exactly 200 characters', () => {
    expectSuccess(expenseMerchantSchema, 'A'.repeat(200))
  })

  it('rejects name over 200 characters after trim', () => {
    expectFailure(expenseMerchantSchema, 'A'.repeat(201))
  })

  it('passes when trimmed content is within the 200-char limit', () => {
    expectSuccess(expenseMerchantSchema, '  ' + 'A'.repeat(200) + '  ')
  })
})

// ---------------------------------------------------------------------------
// expenseCommentSchema
// ---------------------------------------------------------------------------

describe('expenseCommentSchema', () => {
  it('accepts undefined (optional)', () => {
    expectSuccess(expenseCommentSchema, undefined)
  })

  it('accepts a short comment and trims it', () => {
    const result = expectSuccess(expenseCommentSchema, '  Quick note  ')
    expect(result.data).toBe('Quick note')
  })

  it('accepts an empty string (trims to empty)', () => {
    const result = expectSuccess(expenseCommentSchema, '')
    expect(result.data).toBe('')
  })

  it('accepts comment at exactly 1000 characters', () => {
    expectSuccess(expenseCommentSchema, 'A'.repeat(1000))
  })

  it('rejects comment over 1000 characters after trim', () => {
    expectFailure(expenseCommentSchema, 'A'.repeat(1001))
  })

  it('passes when trimmed content is within the 1000-char limit', () => {
    expectSuccess(expenseCommentSchema, '  ' + 'A'.repeat(1000) + '  ')
  })
})

// ---------------------------------------------------------------------------
// expenseSchema (composite)
// ---------------------------------------------------------------------------

describe('expenseSchema', () => {
  const valid = {
    date: '2026-03-15',
    merchant: 'Coffee Shop',
    amount: 450,
  }

  it('accepts a valid expense without comment', () => {
    expectSuccess(expenseSchema, valid)
  })

  it('accepts a valid expense with comment', () => {
    expectSuccess(expenseSchema, { ...valid, comment: 'Latte' })
  })

  it('rejects when any field is invalid', () => {
    expectFailure(expenseSchema, { ...valid, date: 'bad' })
    expectFailure(expenseSchema, { ...valid, amount: -1 })
    expectFailure(expenseSchema, { ...valid, merchant: '' })
  })

  it('trims merchant and comment in output', () => {
    const result = expectSuccess(expenseSchema, {
      ...valid,
      merchant: '  Trimmed  ',
      comment: '  Note  ',
    })
    expect(result.data).toEqual(expect.objectContaining({
      merchant: 'Trimmed',
      comment: 'Note',
    }))
  })
})

// ---------------------------------------------------------------------------
// categoryNameSchema
// ---------------------------------------------------------------------------

describe('categoryNameSchema', () => {
  it('accepts a valid name and returns trimmed value', () => {
    const result = expectSuccess(categoryNameSchema, '  Food  ')
    expect(result.data).toBe('Food')
  })

  it('rejects empty string', () => {
    expectFailure(categoryNameSchema, '')
  })

  it('rejects whitespace-only string', () => {
    expectFailure(categoryNameSchema, '   ')
  })

  it('accepts name at exactly 100 characters', () => {
    expectSuccess(categoryNameSchema, 'A'.repeat(100))
  })

  it('rejects name over 100 characters', () => {
    expectFailure(categoryNameSchema, 'A'.repeat(101))
  })
})

// ---------------------------------------------------------------------------
// categoryIconSchema
// ---------------------------------------------------------------------------

describe('categoryIconSchema', () => {
  it('accepts undefined (optional)', () => {
    expectSuccess(categoryIconSchema, undefined)
  })

  it('accepts a short string', () => {
    expectSuccess(categoryIconSchema, '🍕')
  })

  it('accepts string at exactly 10 characters', () => {
    expectSuccess(categoryIconSchema, 'A'.repeat(10))
  })

  it('rejects string over 10 characters', () => {
    expectFailure(categoryIconSchema, 'A'.repeat(11))
  })
})

// ---------------------------------------------------------------------------
// emailSchema
// ---------------------------------------------------------------------------

describe('emailSchema', () => {
  it('accepts a valid email', () => {
    expectSuccess(emailSchema, 'user@example.com')
  })

  it('accepts email with subdomains', () => {
    expectSuccess(emailSchema, 'user@mail.example.co.uk')
  })

  it('rejects empty string', () => {
    const messages = getErrorMessages(emailSchema, '')
    expect(messages).toContain('Email is required.')
  })

  it('rejects invalid email format', () => {
    const messages = getErrorMessages(emailSchema, 'not-an-email')
    expect(messages).toContain('Enter a valid email address.')
  })

  it('rejects email without domain', () => {
    expectFailure(emailSchema, 'user@')
  })

  it('rejects email without local part', () => {
    expectFailure(emailSchema, '@example.com')
  })
})

// ---------------------------------------------------------------------------
// passwordSchema
// ---------------------------------------------------------------------------

describe('passwordSchema', () => {
  it('accepts a password of 8+ characters', () => {
    expectSuccess(passwordSchema, 'abcdefgh')
    expectSuccess(passwordSchema, 'a'.repeat(100))
  })

  it('rejects a password shorter than 8 characters', () => {
    expectFailure(passwordSchema, 'short')
    expectFailure(passwordSchema, '1234567')
  })

  it('rejects empty string', () => {
    expectFailure(passwordSchema, '')
  })

  it('provides a specific error message for short passwords', () => {
    const messages = getErrorMessages(passwordSchema, 'short')
    expect(messages).toContain('Password must be at least 8 characters.')
  })
})
