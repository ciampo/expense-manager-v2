import { z } from 'zod'
import { parseCurrencyToCents } from '@/lib/format'
import { expenseDateSchema, expenseMerchantSchema, expenseAmountSchema } from '@/lib/schemas'
import { CATEGORY_NAME_MAX_LENGTH, COMMENT_MAX_LENGTH } from '../../../convex/zodSchemas'

export { MAX_FILE_SIZE, ALLOWED_CONTENT_TYPES } from '../../../convex/uploadLimits'

export const expenseFormSchema = z
  .object({
    date: expenseDateSchema,
    merchant: expenseMerchantSchema,
    amount: z.string().transform(parseCurrencyToCents).pipe(expenseAmountSchema),
    categoryId: z.union([z.string(), z.null()]),
    // categoryNameSchema enforces min(1), which would wrongly fail when
    // an existing category is selected. The cross-field refine handles
    // the "required" case; the max mirrors categoryNameSchema.
    newCategoryName: z.string().max(CATEGORY_NAME_MAX_LENGTH, {
      message: `Category name must be ${CATEGORY_NAME_MAX_LENGTH} characters or less.`,
    }),
    // expenseCommentSchema is .optional() (accepts undefined), which is
    // incompatible with the form's always-string value. Mirror its
    // max-length constraint inline.
    comment: z.string().max(COMMENT_MAX_LENGTH, {
      message: `Comment must be ${COMMENT_MAX_LENGTH} characters or less.`,
    }),
  })
  .refine((data) => data.categoryId !== null || data.newCategoryName.trim().length > 0, {
    message: 'Select or create a category.',
    path: ['categoryId'],
  })
