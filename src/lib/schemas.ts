/**
 * Re-exports from the shared Zod schemas in `convex/zodSchemas.ts`.
 *
 * Client code imports from here via the `@/lib/schemas` alias, while
 * the schemas themselves live alongside the Convex mutations so both
 * client and server share a single source of truth.
 */
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
} from '../../convex/zodSchemas'
