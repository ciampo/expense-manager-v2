/**
 * Validation wrappers for Convex mutations.
 *
 * These delegate to the shared Zod schemas in `convex/zodSchemas.ts`,
 * converting ZodError into plain Error with a single descriptive message
 * for clean Convex mutation error reporting.
 */

import type { z } from 'zod'
import {
  expenseSchema,
  categorySchema,
  merchantNameSchema,
  draftExpenseUpdateSchema,
  completeDraftSchema,
  apiKeyNameSchema,
} from './zodSchemas'

export { isValidCalendarDate as isValidDate } from './zodSchemas'

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new Error(result.error.issues[0].message)
  }
  return result.data
}

/**
 * Validate and clean expense fields. Returns trimmed/normalized values.
 * Throws a plain Error with a descriptive message on invalid input.
 */
export function validateExpenseFields(args: {
  date: string
  merchant: string
  amount: number
  comment?: string
}): z.infer<typeof expenseSchema> {
  return parseOrThrow(expenseSchema, args)
}

/**
 * Validate and clean category fields. Returns trimmed/normalized values.
 * Throws a plain Error with a descriptive message on invalid input.
 */
export function validateCategoryFields(args: {
  name: string
  icon?: string
}): z.infer<typeof categorySchema> {
  return parseOrThrow(categorySchema, args)
}

/**
 * Validate and clean a merchant name. Returns the trimmed value.
 * Throws a plain Error with a descriptive message on invalid input.
 */
export function validateMerchantName(name: string): string {
  return parseOrThrow(merchantNameSchema, name)
}

/**
 * Validate and clean draft expense update fields. All fields are optional;
 * present fields are fully validated. Returns trimmed/normalized values.
 * Throws a plain Error with a descriptive message on invalid input.
 */
export function validateDraftUpdate(args: {
  date?: string
  merchant?: string
  amount?: number
  comment?: string
}): z.infer<typeof draftExpenseUpdateSchema> {
  return parseOrThrow(draftExpenseUpdateSchema, args)
}

/**
 * Validate that a draft has all required fields to be completed.
 * Returns trimmed/normalized values.
 * Throws a plain Error with a descriptive message on invalid input.
 */
export function validateDraftCompletion(args: {
  date: string
  merchant: string
  amount: number
  comment?: string
}): z.infer<typeof completeDraftSchema> {
  return parseOrThrow(completeDraftSchema, args)
}

/**
 * Validate and clean an API key name. Returns the trimmed value.
 * Throws a plain Error with a descriptive message on invalid input.
 */
export function validateApiKeyName(name: string): string {
  return parseOrThrow(apiKeyNameSchema, name)
}

/**
 * Normalize a merchant name for matching/dedup: trim + lowercase.
 * Use this everywhere merchant names are compared to ensure consistent
 * matching semantics with `merchants.normalizedName`.
 */
export function normalizeMerchantName(name: string): string {
  return name.trim().toLowerCase()
}
