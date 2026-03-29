import { z } from 'zod'
import { parseCurrencyToCents } from '@/lib/format'
import {
  expenseDateSchema,
  expenseMerchantSchema,
  expenseAmountSchema,
  CATEGORY_NAME_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
} from '@/lib/schemas'

export { MAX_FILE_SIZE, ALLOWED_CONTENT_TYPES } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// Shared field definitions (used by both full and draft schemas)
// ---------------------------------------------------------------------------

const dateField = expenseDateSchema
const merchantField = expenseMerchantSchema
const amountField = z.string().transform(parseCurrencyToCents).pipe(expenseAmountSchema)
const categoryIdField = z.union([z.string(), z.null()])
const newCategoryNameField = z.string().max(CATEGORY_NAME_MAX_LENGTH, {
  message: `Category name must be ${CATEGORY_NAME_MAX_LENGTH} characters or less.`,
})
const commentField = z.string().max(COMMENT_MAX_LENGTH, {
  message: `Comment must be ${COMMENT_MAX_LENGTH} characters or less.`,
})

// ---------------------------------------------------------------------------
// Full expense form schema (all required fields enforced)
// ---------------------------------------------------------------------------

export const expenseFormSchema = z
  .object({
    date: dateField,
    merchant: merchantField,
    amount: amountField,
    categoryId: categoryIdField,
    newCategoryName: newCategoryNameField,
    comment: commentField,
  })
  .refine((data) => data.categoryId !== null || data.newCategoryName.trim().length > 0, {
    message: 'Select or create a category.',
    path: ['categoryId'],
  })

// ---------------------------------------------------------------------------
// Draft expense form schema — relaxed validation for saving partial data.
// Used by the complete-draft mode's "Save draft" handler.
// ---------------------------------------------------------------------------

export const draftExpenseFormSchema = z.object({
  date: dateField.optional(),
  merchant: merchantField.optional(),
  amount: amountField.optional(),
  categoryId: categoryIdField.optional(),
  newCategoryName: newCategoryNameField.optional(),
  comment: commentField.optional(),
})
