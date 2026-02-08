/**
 * Pure validation functions for expense data.
 *
 * These are intentionally free of Convex imports so they can be unit-tested
 * directly with Vitest.
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Check whether a YYYY-MM-DD string represents a real calendar date.
 * Rejects format-valid but logically invalid dates like 2026-02-30.
 */
export function isValidDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

/**
 * Validate expense fields and throw descriptive errors.
 *
 * Rules:
 * - `date` must be a valid YYYY-MM-DD calendar date
 * - `amount` must be a positive integer (stored in EUR cents)
 * - `merchant` must be non-empty after trimming, max 200 characters
 * - `comment` (optional) max 1000 characters after trimming
 */
export function validateExpenseFields(args: {
  date: string
  merchant: string
  amount: number
  comment?: string
}) {
  if (!isValidDate(args.date)) {
    throw new Error('Invalid date. Expected a valid YYYY-MM-DD date.')
  }
  if (!Number.isInteger(args.amount) || args.amount <= 0) {
    throw new Error('Amount must be a positive integer (cents).')
  }
  const trimmedMerchant = args.merchant.trim()
  if (!trimmedMerchant) {
    throw new Error('Merchant name is required.')
  }
  if (trimmedMerchant.length > 200) {
    throw new Error('Merchant name must be 200 characters or less.')
  }
  if (args.comment !== undefined && args.comment.trim().length > 1000) {
    throw new Error('Comment must be 1000 characters or less.')
  }
}
