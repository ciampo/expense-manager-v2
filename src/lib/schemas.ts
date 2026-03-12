/**
 * Client-facing re-exports from shared Convex modules.
 *
 * Client code imports from here via the `@/lib/schemas` alias, while
 * the source-of-truth definitions live alongside the Convex mutations
 * so both client and server share a single source of truth.
 *
 * Sources:
 * - `convex/zodSchemas.ts` — Zod schemas and validation-limit constants
 * - `convex/uploadLimits.ts` — file-upload constraints
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

export { MAX_FILE_SIZE, ALLOWED_CONTENT_TYPES } from '../../convex/uploadLimits'
