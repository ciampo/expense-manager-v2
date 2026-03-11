/**
 * Re-exports from the shared Zod schemas in `convex/zodSchemas.ts`.
 *
 * Client code imports from here via the `@/lib/schemas` alias, while
 * the schemas themselves live alongside the Convex mutations so both
 * client and server share a single source of truth.
 */
export {
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
  isValidCalendarDate,
} from '../../convex/zodSchemas'
