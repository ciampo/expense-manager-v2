/**
 * Pure validation functions for expense and category data.
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

// ---------------------------------------------------------------------------
// Category validation
// ---------------------------------------------------------------------------

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})

function graphemeCount(str: string): number {
  let count = 0
  for (const _ of GRAPHEME_SEGMENTER.segment(str)) {
    count++
  }
  return count
}

/**
 * Validate category fields and return cleaned values.
 *
 * Rules:
 * - `name` must be non-empty after trimming, max 100 characters
 * - `icon` (optional) max 10 grapheme clusters (counted via Intl.Segmenter
 *   so that multi-code-unit emoji are measured as visible characters)
 *
 * Pre-trim hard caps reject obviously oversized payloads before any string
 * traversal (e.g. trim / grapheme segmentation) to limit CPU/memory cost.
 */
export function validateCategoryFields(args: {
  name: string
  icon?: string
}): { name: string; icon: string | undefined } {
  if (args.name.length > 1000) {
    throw new Error('Category name must be at most 100 characters.')
  }
  const trimmedName = args.name.trim()
  if (trimmedName.length === 0) {
    throw new Error('Category name is required.')
  }
  if (trimmedName.length > 100) {
    throw new Error('Category name must be at most 100 characters.')
  }

  let icon: string | undefined
  if (args.icon !== undefined) {
    if (args.icon.length > 100) {
      throw new Error('Category icon must be at most 10 characters.')
    }
    const trimmedIcon = args.icon.trim()
    if (trimmedIcon) {
      if (graphemeCount(trimmedIcon) > 10) {
        throw new Error('Category icon must be at most 10 characters.')
      }
      icon = trimmedIcon
    }
  }

  return { name: trimmedName, icon }
}
