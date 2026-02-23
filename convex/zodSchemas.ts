/**
 * Shared Zod validation schemas — the single source of truth for both
 * client-side forms and server-side Convex mutations.
 *
 * Consumed by:
 * - Client forms via TanStack Form's `validators.onSubmit`
 * - Convex mutations via the thin wrappers in `convex/validation.ts`
 * - Unit tests directly
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function isValidCalendarDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})

function graphemeCount(str: string): number {
  let count = 0
  for (const _ of GRAPHEME_SEGMENTER.segment(str)) {
    count++
  }
  return count
}

// ---------------------------------------------------------------------------
// Expense schemas
// ---------------------------------------------------------------------------

export const expenseDateSchema = z.string().refine(isValidCalendarDate, {
  message: 'Invalid date. Expected a valid YYYY-MM-DD date.',
})

export const expenseAmountSchema = z
  .number()
  .int({ message: 'Amount must be a whole number (cents).' })
  .positive({ message: 'Amount must be positive.' })

export const expenseMerchantSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(1, { message: 'Merchant name is required.' })
      .max(200, { message: 'Merchant name must be 200 characters or less.' }),
  )

export const expenseCommentSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().max(1000, { message: 'Comment must be 1000 characters or less.' }))
  .transform((s) => s || undefined)
  .optional()

export const expenseSchema = z.object({
  date: expenseDateSchema,
  merchant: expenseMerchantSchema,
  amount: expenseAmountSchema,
  comment: expenseCommentSchema,
})

// ---------------------------------------------------------------------------
// Category schemas
// ---------------------------------------------------------------------------

/**
 * Pre-trim hard cap (1000 raw chars) rejects obviously oversized payloads
 * before any string traversal, limiting CPU/memory cost on the server.
 */
export const categoryNameSchema = z
  .string()
  .max(1000, { message: 'Category name must be 100 characters or less.' })
  .transform((s) => s.trim())
  .pipe(
    z.string().min(1, { message: 'Category name is required.' }).max(100, {
      message: 'Category name must be 100 characters or less.',
    }),
  )

/**
 * Pre-trim hard cap (100 raw chars) rejects oversized payloads before
 * grapheme segmentation. After trimming, empty/whitespace-only strings
 * are normalized to `undefined`.
 */
export const categoryIconSchema = z
  .string()
  .refine((s) => s.length <= 100, {
    message: 'Category icon must be 10 characters or less.',
  })
  .transform((s) => s.trim() || undefined)
  .refine((s) => s === undefined || graphemeCount(s) <= 10, {
    message: 'Category icon must be 10 characters or less.',
  })
  .optional()

export const categorySchema = z.object({
  name: categoryNameSchema,
  icon: categoryIconSchema,
})

// ---------------------------------------------------------------------------
// Auth schemas (client-only, not used in Convex mutations)
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .min(1, { message: 'Email is required.' })
  .email({ message: 'Enter a valid email address.' })

export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters.' })
