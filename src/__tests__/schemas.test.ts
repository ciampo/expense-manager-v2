import { describe, it, expect } from 'vitest'
import {
  MERCHANT_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  CATEGORY_NAME_MAX_LENGTH,
  expenseDateSchema,
  expenseAmountSchema,
  expenseMerchantSchema,
  expenseCommentSchema,
  expenseSchema,
  categoryNameSchema,
  categoryIconSchema,
  categorySchema,
  emailSchema,
  passwordSchema,
} from '@/lib/schemas'

function expectSuccess(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown } },
  value: unknown,
) {
  const result = schema.safeParse(value)
  expect(result.success).toBe(true)
  return result
}

function expectFailure(
  schema: {
    safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ message: string }> } }
  },
  value: unknown,
) {
  const result = schema.safeParse(value)
  expect(result.success).toBe(false)
  return result
}

function getErrorMessages(
  schema: {
    safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ message: string }> } }
  },
  value: unknown,
): string[] {
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

  it('rejects NaN', () => {
    expectFailure(expenseAmountSchema, NaN)
  })

  it('rejects Infinity', () => {
    expectFailure(expenseAmountSchema, Infinity)
    expectFailure(expenseAmountSchema, -Infinity)
  })

  it('provides specific error messages', () => {
    expect(getErrorMessages(expenseAmountSchema, 0)).toEqual(
      expect.arrayContaining([expect.stringContaining('positive')]),
    )
    expect(getErrorMessages(expenseAmountSchema, 1.5)).toEqual(
      expect.arrayContaining([expect.stringContaining('whole number')]),
    )
    expect(getErrorMessages(expenseAmountSchema, Infinity).length).toBeGreaterThan(0)
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

  it(`accepts name at exactly ${MERCHANT_MAX_LENGTH} characters`, () => {
    expectSuccess(expenseMerchantSchema, 'A'.repeat(MERCHANT_MAX_LENGTH))
  })

  it(`rejects name over ${MERCHANT_MAX_LENGTH} characters after trim`, () => {
    expectFailure(expenseMerchantSchema, 'A'.repeat(MERCHANT_MAX_LENGTH + 1))
  })

  it(`passes when trimmed content is within the ${MERCHANT_MAX_LENGTH}-char limit`, () => {
    expectSuccess(expenseMerchantSchema, '  ' + 'A'.repeat(MERCHANT_MAX_LENGTH) + '  ')
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

  it('normalizes empty string to undefined', () => {
    const result = expectSuccess(expenseCommentSchema, '')
    expect(result.data).toBeUndefined()
  })

  it('normalizes whitespace-only string to undefined', () => {
    const result = expectSuccess(expenseCommentSchema, '   ')
    expect(result.data).toBeUndefined()
  })

  it(`accepts comment at exactly ${COMMENT_MAX_LENGTH} characters`, () => {
    expectSuccess(expenseCommentSchema, 'A'.repeat(COMMENT_MAX_LENGTH))
  })

  it(`rejects comment over ${COMMENT_MAX_LENGTH} characters after trim`, () => {
    expectFailure(expenseCommentSchema, 'A'.repeat(COMMENT_MAX_LENGTH + 1))
  })

  it(`passes when trimmed content is within the ${COMMENT_MAX_LENGTH}-char limit`, () => {
    expectSuccess(expenseCommentSchema, '  ' + 'A'.repeat(COMMENT_MAX_LENGTH) + '  ')
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
    expect(result.data).toEqual(
      expect.objectContaining({
        merchant: 'Trimmed',
        comment: 'Note',
      }),
    )
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

  it(`accepts name at exactly ${CATEGORY_NAME_MAX_LENGTH} characters`, () => {
    expectSuccess(categoryNameSchema, 'A'.repeat(CATEGORY_NAME_MAX_LENGTH))
  })

  it(`rejects name over ${CATEGORY_NAME_MAX_LENGTH} characters`, () => {
    expectFailure(categoryNameSchema, 'A'.repeat(CATEGORY_NAME_MAX_LENGTH + 1))
  })

  it(`accepts padded name within ${CATEGORY_NAME_MAX_LENGTH}-char limit after trim`, () => {
    const result = expectSuccess(
      categoryNameSchema,
      '  ' + 'A'.repeat(CATEGORY_NAME_MAX_LENGTH) + '  ',
    )
    expect(result.data).toBe('A'.repeat(CATEGORY_NAME_MAX_LENGTH))
  })

  it('rejects very large name via pre-trim hard cap', () => {
    expectFailure(categoryNameSchema, 'A'.repeat(1001))
  })
})

// ---------------------------------------------------------------------------
// categoryIconSchema
// ---------------------------------------------------------------------------

describe('categoryIconSchema', () => {
  it('accepts undefined (optional)', () => {
    expectSuccess(categoryIconSchema, undefined)
  })

  it('normalizes empty string to undefined', () => {
    const result = expectSuccess(categoryIconSchema, '')
    expect(result.data).toBeUndefined()
  })

  it('normalizes whitespace-only string to undefined', () => {
    const result = expectSuccess(categoryIconSchema, '   ')
    expect(result.data).toBeUndefined()
  })

  it('trims whitespace around icon', () => {
    const result = expectSuccess(categoryIconSchema, ' 🍕 ')
    expect(result.data).toBe('🍕')
  })

  it('accepts a simple emoji', () => {
    expectSuccess(categoryIconSchema, '🍕')
  })

  it('accepts ASCII string at exactly 10 characters', () => {
    expectSuccess(categoryIconSchema, 'A'.repeat(10))
  })

  it('rejects ASCII string over 10 characters', () => {
    expectFailure(categoryIconSchema, 'A'.repeat(11))
  })

  it('rejects very large icon via pre-trim hard cap', () => {
    expectFailure(categoryIconSchema, 'x'.repeat(101))
  })

  // ---- Grapheme-vs-code-unit regression tests ----
  // JS string .length counts UTF-16 code units, not visible characters.
  // The schema uses Intl.Segmenter grapheme counting so that complex
  // emoji are measured as visible characters. The cases below would
  // fail if the schema naïvely used z.string().max(10).

  it('accepts a ZWJ family emoji (1 grapheme, 11 code units)', () => {
    const family = '👨‍👩‍👧‍👦'
    expect(family.length).toBe(11)
    expectSuccess(categoryIconSchema, family)
  })

  it('accepts a flag emoji (1 grapheme, 4 code units)', () => {
    const flag = '🇺🇸'
    expect(flag.length).toBe(4)
    expectSuccess(categoryIconSchema, flag)
  })

  it('accepts 10 surrogate-pair emoji (10 graphemes, 20 code units)', () => {
    const tenEmoji = '😀😁😂🤣😃😄😅😆😉😊'
    expect(tenEmoji.length).toBe(20)
    expectSuccess(categoryIconSchema, tenEmoji)
  })

  it('rejects 11 surrogate-pair emoji (11 graphemes)', () => {
    const elevenEmoji = '😀😁😂🤣😃😄😅😆😉😊😋'
    expectFailure(categoryIconSchema, elevenEmoji)
  })

  it('accepts a keycap sequence (1 grapheme, 3 code units)', () => {
    const keycap = '#️⃣'
    expect(keycap.length).toBe(3)
    expectSuccess(categoryIconSchema, keycap)
  })

  it('accepts mixed ASCII and emoji counted by graphemes (10 graphemes, 15 code units)', () => {
    const mixed = 'A😀B😁C😂D😃E😄'
    expect(mixed.length).toBe(15)
    expectSuccess(categoryIconSchema, mixed)
  })
})

// ---------------------------------------------------------------------------
// categorySchema (composite)
// ---------------------------------------------------------------------------

describe('categorySchema', () => {
  it('accepts a valid category with name and icon', () => {
    const result = expectSuccess(categorySchema, { name: 'Food', icon: '🍕' })
    expect(result.data).toEqual({ name: 'Food', icon: '🍕' })
  })

  it('accepts a valid category without icon', () => {
    const result = expectSuccess(categorySchema, { name: 'Transport' })
    expect(result.data).toEqual({ name: 'Transport', icon: undefined })
  })

  it('trims name and icon in output', () => {
    const result = expectSuccess(categorySchema, {
      name: '  Groceries  ',
      icon: ' 🛒 ',
    })
    expect(result.data).toEqual({ name: 'Groceries', icon: '🛒' })
  })

  it('normalizes empty icon to undefined', () => {
    const result = expectSuccess(categorySchema, { name: 'Bills', icon: '' })
    expect(result.data).toEqual({ name: 'Bills', icon: undefined })
  })

  it('rejects when name is missing', () => {
    expectFailure(categorySchema, { icon: '🎮' })
  })

  it('rejects when name is empty', () => {
    expectFailure(categorySchema, { name: '', icon: '🎮' })
  })

  it('rejects when name exceeds limit', () => {
    expectFailure(categorySchema, { name: 'A'.repeat(CATEGORY_NAME_MAX_LENGTH + 1) })
  })

  it('rejects when icon exceeds grapheme limit', () => {
    expectFailure(categorySchema, { name: 'Valid', icon: '😀😁😂🤣😃😄😅😆😉😊😋' })
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
