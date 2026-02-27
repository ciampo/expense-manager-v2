/**
 * Re-exports from the shared Zod schemas in `convex/zodSchemas.ts`.
 *
 * Client code imports from here via the `@/lib/schemas` alias, while
 * the schemas themselves live alongside the Convex mutations so both
 * client and server share a single source of truth.
 */
import {
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
  isValidCalendarDate,
} from '../../convex/zodSchemas'

export {
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
  isValidCalendarDate,
}

import { z } from 'zod'
import { parseCurrencyToCents } from '@/lib/format'

/**
 * Client-side form schema for the expense form. Composes shared server
 * schemas with form-specific transforms (string amount → cents via
 * transform/pipe, category union: existing ID or new name).
 */
export const expenseFormSchema = z
  .object({
    date: expenseDateSchema,
    merchant: expenseMerchantSchema,
    amount: z.string().transform(parseCurrencyToCents).pipe(expenseAmountSchema),
    categoryId: z.union([z.string(), z.null()]),
    newCategoryName: z.string().max(100, {
      message: 'Category name must be 100 characters or less.',
    }),
    comment: z.string().max(1000, {
      message: 'Comment must be 1000 characters or less.',
    }),
  })
  .refine((data) => data.categoryId !== null || data.newCategoryName.trim().length > 0, {
    message: 'Select or create a category.',
    path: ['categoryId'],
  })
