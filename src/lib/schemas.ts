/**
 * Client-side Zod validation schemas.
 *
 * These mirror the pure validation functions in `convex/validation.ts`.
 * Keep both files in sync when rules change.
 */

import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidCalendarDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

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
    z.string().min(1, { message: 'Merchant name is required.' }).max(200, {
      message: 'Merchant name must be 200 characters or less.',
    }),
  )

export const expenseCommentSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().max(1000, { message: 'Comment must be 1000 characters or less.' }))
  .optional()

export const expenseSchema = z.object({
  date: expenseDateSchema,
  merchant: expenseMerchantSchema,
  amount: expenseAmountSchema,
  comment: expenseCommentSchema,
})

export const categoryNameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z.string().min(1, { message: 'Category name is required.' }).max(100, {
      message: 'Category name must be 100 characters or less.',
    }),
  )

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

export const categoryIconSchema = z
  .string()
  .refine((s) => graphemeCount(s) <= 10, {
    message: 'Category icon must be 10 characters or less.',
  })
  .optional()

export const emailSchema = z
  .string()
  .min(1, { message: 'Email is required.' })
  .email({ message: 'Enter a valid email address.' })

export const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters.' })
