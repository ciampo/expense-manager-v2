import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

/**
 * Clean up orphaned upload records (and their storage files) once a day.
 *
 * An upload is considered orphaned when it is older than 24 hours and no
 * expense references its storageId. This covers the case where a user
 * uploads a file but never saves the expense (e.g. navigates away).
 */
crons.daily(
  'cleanup orphaned uploads',
  { hourUTC: 3, minuteUTC: 0 },
  internal.storage.cleanupOrphanedUploads,
)

/**
 * Remove user-custom categories not referenced by any expense.
 * Complements the per-deletion cleanup in expenses.remove — catches
 * orphans from bulk imports, edge cases, or older data.
 */
crons.daily(
  'cleanup orphaned categories',
  { hourUTC: 3, minuteUTC: 10 },
  internal.categories.cleanupOrphanedCategories,
)

/**
 * Remove merchant records not referenced by any expense.
 */
crons.daily(
  'cleanup orphaned merchants',
  { hourUTC: 3, minuteUTC: 20 },
  internal.merchants.cleanupOrphanedMerchants,
)

export default crons
