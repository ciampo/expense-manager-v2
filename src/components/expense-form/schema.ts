import { z } from 'zod'
import { parseCurrencyToCents } from '@/lib/format'
import { expenseDateSchema, expenseMerchantSchema, expenseAmountSchema } from '@/lib/schemas'

export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const ACCEPTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]

export const expenseFormSchema = z
  .object({
    date: expenseDateSchema,
    merchant: expenseMerchantSchema,
    amount: z.string().transform(parseCurrencyToCents).pipe(expenseAmountSchema),
    categoryId: z.union([z.string(), z.null()]),
    // categoryNameSchema enforces min(1), which would wrongly fail when
    // an existing category is selected. The cross-field refine handles
    // the "required" case; the max mirrors categoryNameSchema.
    newCategoryName: z.string().max(100, {
      message: 'Category name must be 100 characters or less.',
    }),
    // expenseCommentSchema is .optional() (accepts undefined), which is
    // incompatible with the form's always-string value. Mirror its
    // max-length constraint inline.
    comment: z.string().max(1000, {
      message: 'Comment must be 1000 characters or less.',
    }),
  })
  .refine((data) => data.categoryId !== null || data.newCategoryName.trim().length > 0, {
    message: 'Select or create a category.',
    path: ['categoryId'],
  })
