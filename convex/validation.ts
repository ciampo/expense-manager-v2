/**
 * Validation wrappers for Convex mutations.
 *
 * These delegate to the shared Zod schemas in `convex/zodSchemas.ts`,
 * converting ZodError into plain Error with a single descriptive message
 * for clean Convex mutation error reporting.
 */

import type { z } from 'zod'
import { expenseSchema, categorySchema, merchantNameSchema } from './zodSchemas'

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
