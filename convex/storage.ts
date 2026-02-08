import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internalMutation, mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { auth } from './auth'

const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const CLEANUP_BATCH_SIZE = 100

// ---------------------------------------------------------------------------
// Shared helpers (used by both storage.ts and expenses.ts)
// ---------------------------------------------------------------------------

/**
 * Verify that the given `attachmentId` has an `uploads` record owned by `userId`.
 * Throws if no records exist or any record belongs to another user.
 *
 * Collects all matching rows (instead of `.first()`) so that even if duplicate
 * records exist the check is deterministic and never grants access based on
 * whichever row happens to be returned first.
 */
export async function verifyAttachmentOwnership(
  ctx: { db: QueryCtx['db'] },
  attachmentId: Id<'_storage'>,
  userId: Id<'users'>,
) {
  const uploads = await ctx.db
    .query('uploads')
    .withIndex('by_storage_id', (q) => q.eq('storageId', attachmentId))
    .collect()

  if (uploads.length === 0 || !uploads.every((u) => u.userId === userId)) {
    throw new Error('Attachment not found or not owned by current user')
  }
}

/**
 * Delete all `uploads` records for a given storageId.
 *
 * Collects all matching rows so that no stale records are left behind even
 * if duplicate rows exist for the same storageId.
 */
export async function deleteUploadRecord(
  ctx: { db: MutationCtx['db'] },
  storageId: Id<'_storage'>,
) {
  const uploads = await ctx.db
    .query('uploads')
    .withIndex('by_storage_id', (q) => q.eq('storageId', storageId))
    .collect()

  for (const upload of uploads) {
    await ctx.db.delete(upload._id)
  }
}

/**
 * Generate an upload URL for file storage
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Register ownership of a freshly uploaded file.
 *
 * The client must call this immediately after uploading a file and receiving
 * the storageId. It records a (storageId → userId) mapping in the `uploads`
 * table so that `getUrl` and expense mutations can verify ownership before
 * the file is linked to an expense.
 */
export const confirmUpload = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    // Collect all existing records for this storageId (normally 0 or 1,
    // but we handle duplicates defensively).
    const existing = await ctx.db
      .query('uploads')
      .withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId))
      .collect()

    // Reject if any record belongs to a different user
    if (existing.some((u) => u.userId !== userId)) {
      throw new Error('File already claimed by another user')
    }

    // Idempotent: skip if the same user already registered this upload
    if (existing.length > 0) {
      return
    }

    await ctx.db.insert('uploads', {
      storageId: args.storageId,
      userId,
      createdAt: Date.now(),
    })
  },
})

/**
 * Get a download URL for a file (verifies ownership).
 *
 * Ownership is satisfied when the current user either:
 * - Has a record in the `uploads` table for this storageId (preview before save), OR
 * - Has an expense that references this storageId (viewing saved attachment)
 */
export const getUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return null
    }

    // Check 1: user owns the upload record(s) (covers preview-before-save).
    // Collect all rows so the check is deterministic even if duplicates exist.
    const uploads = await ctx.db
      .query('uploads')
      .withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId))
      .collect()

    if (uploads.length > 0 && uploads.every((u) => u.userId === userId)) {
      return await ctx.storage.getUrl(args.storageId)
    }

    // Check 2: user owns an expense referencing this file
    const expense = await ctx.db
      .query('expenses')
      .withIndex('by_user_and_attachment', (q) =>
        q.eq('userId', userId).eq('attachmentId', args.storageId),
      )
      .first()

    if (expense) {
      return await ctx.storage.getUrl(args.storageId)
    }

    return null
  },
})

/**
 * Delete a file from storage (verifies ownership via expense).
 */
export const deleteFile = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    // Verify the storage ID belongs to an expense owned by the current user
    const expense = await ctx.db
      .query('expenses')
      .withIndex('by_user_and_attachment', (q) =>
        q.eq('userId', userId).eq('attachmentId', args.storageId),
      )
      .first()

    if (!expense) {
      throw new Error('File not found or not owned by current user')
    }

    await ctx.storage.delete(args.storageId)

    // Clean up the upload record if it exists
    await deleteUploadRecord(ctx, args.storageId)

    return true
  },
})

/**
 * Clean up orphaned files and upload records older than 24 hours.
 *
 * Two passes:
 * 1. **Tracked orphans** — `uploads` records with no matching expense.
 *    Deletes both the storage file and the upload record.
 * 2. **Untracked orphans** — storage files that have neither an `uploads`
 *    record nor an expense reference (e.g. `confirmUpload` failed after
 *    the client uploaded). Deletes the storage file directly.
 *
 * Processes up to {@link CLEANUP_BATCH_SIZE} items per pass to stay within
 * Convex mutation execution limits. The daily cron is sufficient for normal
 * volumes; if a backlog builds up it will be drained over successive runs.
 *
 * Called by the daily cron defined in crons.ts.
 */
export const cleanupOrphanedUploads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ORPHAN_TTL_MS
    let deleted = 0

    // --- Pass 1: tracked orphans (uploads table) --------------------------
    const oldUploads = await ctx.db
      .query('uploads')
      .withIndex('by_created_at', (q) => q.lt('createdAt', cutoff))
      .take(CLEANUP_BATCH_SIZE)

    for (const upload of oldUploads) {
      const expense = await ctx.db
        .query('expenses')
        .withIndex('by_user_and_attachment', (q) =>
          q.eq('userId', upload.userId).eq('attachmentId', upload.storageId),
        )
        .first()

      if (!expense) {
        try {
          await ctx.storage.delete(upload.storageId)
        } catch (err) {
          console.warn(
            `Failed to delete storage file ${upload.storageId}, removing upload record anyway:`,
            err,
          )
        }
        await ctx.db.delete(upload._id)
        deleted++
      }
    }

    // --- Pass 2: untracked orphans (_storage system table) ----------------
    // Catches files where the client upload succeeded but confirmUpload
    // never completed (transient error, tab closed, etc.).
    const allFiles = await ctx.db.system
      .query('_storage')
      .take(CLEANUP_BATCH_SIZE)

    for (const file of allFiles) {
      // Only consider files older than the TTL
      if (file._creationTime > cutoff) {
        continue
      }

      // Skip if there's a matching upload record (handled in pass 1)
      const upload = await ctx.db
        .query('uploads')
        .withIndex('by_storage_id', (q) => q.eq('storageId', file._id))
        .first()

      if (upload) {
        continue
      }

      // Skip if any expense references this file
      // We can't use the composite index without a userId, so we check
      // all expenses. This is acceptable because pass 2 only runs on
      // files that have NO upload record, which is an edge case.
      const expenses = await ctx.db
        .query('expenses')
        .filter((q) => q.eq(q.field('attachmentId'), file._id))
        .first()

      if (!expenses) {
        try {
          await ctx.storage.delete(file._id)
        } catch (err) {
          console.warn(
            `Failed to delete untracked storage file ${file._id}:`,
            err,
          )
        }
        deleted++
      }
    }

    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} orphaned file(s)`)
    }
  },
})
