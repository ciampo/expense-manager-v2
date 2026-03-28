import { describe, it, expect } from 'vitest'
import {
  draftExpenseUpdateSchema,
  completeDraftSchema,
  apiKeyNameSchema,
  API_KEY_NAME_MAX_LENGTH,
  MERCHANT_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
} from '../../convex/zodSchemas'
import { expectSuccess, expectFailure, getErrorMessages } from './test-utils'

// ---------------------------------------------------------------------------
// draftExpenseUpdateSchema
// ---------------------------------------------------------------------------

describe('draftExpenseUpdateSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expectSuccess(draftExpenseUpdateSchema, {})
  })

  it('accepts partial data with only date', () => {
    expectSuccess(draftExpenseUpdateSchema, { date: '2026-03-15' })
  })

  it('accepts partial data with only merchant', () => {
    expectSuccess(draftExpenseUpdateSchema, { merchant: 'Coffee Shop' })
  })

  it('accepts partial data with only amount', () => {
    expectSuccess(draftExpenseUpdateSchema, { amount: 450 })
  })

  it('accepts partial data with only comment', () => {
    expectSuccess(draftExpenseUpdateSchema, { comment: 'Quick note' })
  })

  it('accepts a fully populated object', () => {
    expectSuccess(draftExpenseUpdateSchema, {
      date: '2026-03-15',
      merchant: 'Coffee Shop',
      amount: 450,
      comment: 'Quick note',
    })
  })

  it('validates date when present — rejects invalid date', () => {
    expectFailure(draftExpenseUpdateSchema, { date: '2026-02-30' })
  })

  it('validates date when present — rejects malformed date', () => {
    expectFailure(draftExpenseUpdateSchema, { date: 'not-a-date' })
  })

  it('validates merchant when present — rejects empty string', () => {
    expectFailure(draftExpenseUpdateSchema, { merchant: '' })
  })

  it('validates merchant when present — rejects whitespace-only', () => {
    expectFailure(draftExpenseUpdateSchema, { merchant: '   ' })
  })

  it(`validates merchant when present — rejects over ${MERCHANT_MAX_LENGTH} chars`, () => {
    expectFailure(draftExpenseUpdateSchema, {
      merchant: 'A'.repeat(MERCHANT_MAX_LENGTH + 1),
    })
  })

  it('validates amount when present — rejects zero', () => {
    expectFailure(draftExpenseUpdateSchema, { amount: 0 })
  })

  it('validates amount when present — rejects negative', () => {
    expectFailure(draftExpenseUpdateSchema, { amount: -100 })
  })

  it('validates amount when present — rejects non-integer', () => {
    expectFailure(draftExpenseUpdateSchema, { amount: 12.34 })
  })

  it(`validates comment when present — rejects over ${COMMENT_MAX_LENGTH} chars`, () => {
    expectFailure(draftExpenseUpdateSchema, {
      comment: 'A'.repeat(COMMENT_MAX_LENGTH + 1),
    })
  })

  it('trims merchant when present', () => {
    const result = draftExpenseUpdateSchema.safeParse({ merchant: '  Coffee Shop  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.merchant).toBe('Coffee Shop')
    }
  })

  it('normalizes empty comment to undefined', () => {
    const result = draftExpenseUpdateSchema.safeParse({ comment: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.comment).toBeUndefined()
    }
  })
})

// ---------------------------------------------------------------------------
// completeDraftSchema
// ---------------------------------------------------------------------------

describe('completeDraftSchema', () => {
  const valid = {
    date: '2026-03-15',
    merchant: 'Coffee Shop',
    amount: 450,
  }

  it('accepts a complete expense', () => {
    expectSuccess(completeDraftSchema, valid)
  })

  it('accepts a complete expense with comment', () => {
    expectSuccess(completeDraftSchema, { ...valid, comment: 'Quick note' })
  })

  it('rejects missing date', () => {
    expectFailure(completeDraftSchema, { merchant: 'Coffee Shop', amount: 450 })
  })

  it('rejects missing merchant', () => {
    expectFailure(completeDraftSchema, { date: '2026-03-15', amount: 450 })
  })

  it('rejects missing amount', () => {
    expectFailure(completeDraftSchema, { date: '2026-03-15', merchant: 'Coffee Shop' })
  })

  it('rejects empty object', () => {
    expectFailure(completeDraftSchema, {})
  })

  it('validates fields when present — rejects invalid date', () => {
    expectFailure(completeDraftSchema, { ...valid, date: '2026-02-30' })
  })

  it('validates fields when present — rejects invalid amount', () => {
    expectFailure(completeDraftSchema, { ...valid, amount: -1 })
  })

  it('returns descriptive error for missing date', () => {
    const messages = getErrorMessages(completeDraftSchema, {
      merchant: 'Coffee Shop',
      amount: 450,
    })
    expect(messages.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// apiKeyNameSchema
// ---------------------------------------------------------------------------

describe('apiKeyNameSchema', () => {
  it('accepts a valid name', () => {
    expectSuccess(apiKeyNameSchema, 'My API Key')
  })

  it('trims whitespace', () => {
    const result = apiKeyNameSchema.safeParse('  My API Key  ')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('My API Key')
    }
  })

  it('rejects empty string', () => {
    expectFailure(apiKeyNameSchema, '')
  })

  it('rejects whitespace-only string', () => {
    expectFailure(apiKeyNameSchema, '   ')
  })

  it(`accepts name at exactly ${API_KEY_NAME_MAX_LENGTH} characters`, () => {
    expectSuccess(apiKeyNameSchema, 'A'.repeat(API_KEY_NAME_MAX_LENGTH))
  })

  it(`rejects name over ${API_KEY_NAME_MAX_LENGTH} characters`, () => {
    expectFailure(apiKeyNameSchema, 'A'.repeat(API_KEY_NAME_MAX_LENGTH + 1))
  })

  it('checks length on trimmed value', () => {
    const padded = '  ' + 'A'.repeat(API_KEY_NAME_MAX_LENGTH) + '  '
    expectSuccess(apiKeyNameSchema, padded)
  })

  it('returns descriptive error for empty name', () => {
    const messages = getErrorMessages(apiKeyNameSchema, '')
    expect(messages).toContain('API key name is required.')
  })

  it('returns descriptive error for too-long name', () => {
    const messages = getErrorMessages(apiKeyNameSchema, 'A'.repeat(API_KEY_NAME_MAX_LENGTH + 1))
    expect(messages).toContain(
      `API key name must be ${API_KEY_NAME_MAX_LENGTH} characters or less.`,
    )
  })
})
