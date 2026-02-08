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
  { hourUTC: 3, minuteUTC: 0 }, // 3:00 AM UTC
  internal.storage.cleanupOrphanedUploads,
)

export default crons
