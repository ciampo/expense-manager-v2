import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internalMutation, mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { auth } from './auth'

const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const CLEANUP_BATCH_SIZE = 100

// ── Helpers ─────────────────────────────────────────────────────────────
//
// These are used by both storage.ts and expenses.ts.  They are
// intentionally typed with minimal context interfaces so they can accept
// both MutationCtx and QueryCtx.
//
// Convex mutations are **serializable transactions**: two concurrent
// mutations that touch the same rows are automatically serialised and
// retried, so the `uploads` table will always contain at most one record
// per storageId.  All lookups therefore use `.first()`.

/**
 * Return the single `uploads` record for a storageId, or `null`.
 */
async function getUploadRecord(
  ctx: { db: QueryCtx['db'] },
  storageId: Id<'_storage'>,
) {
  return ctx.db
    .query('uploads')
    .withIndex('by_storage_id', (q) => q.eq('storageId', storageId))
    .first()
}

/**
 * Return `true` if any expense — regardless of owner — references the
 * given storageId.
 */
async function isFileReferencedByExpense(
  ctx: { db: QueryCtx['db'] },
  storageId: Id<'_storage'>,
) {
  const expense = await ctx.db
    .query('expenses')
    .withIndex('by_attachment', (q) => q.eq('attachmentId', storageId))
    .first()
  return expense !== null
}

/**
 * Verify that `storageId` has an upload record owned by `userId`.
 *
 * Throws if no record exists or the record belongs to a different user.
 * Called by `expenses.create` and `expenses.update` when attaching a file.
 */
export async function verifyAttachmentOwnership(
  ctx: { db: QueryCtx['db'] },
  attachmentId: Id<'_storage'>,
  userId: Id<'users'>,
) {
  const upload = await getUploadRecord(ctx, attachmentId)
  if (!upload || upload.userId !== userId) {
    throw new Error('Attachment not found or not owned by current user')
  }
}

/**
 * Delete the upload record for a storageId (if one exists).
 */
export async function deleteUploadRecord(
  ctx: { db: MutationCtx['db'] },
  storageId: Id<'_storage'>,
) {
  const upload = await getUploadRecord(ctx, storageId)
  if (upload) {
    await ctx.db.delete(upload._id)
  }
}

// ── Public mutations ────────────────────────────────────────────────────

/**
 * Generate a presigned upload URL.
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
 * The client calls this immediately after uploading a file and receiving
 * the storageId.  It creates a `(storageId, userId)` mapping in the
 * `uploads` table that downstream queries and mutations rely on.
 *
 * **Rejects** if:
 * - Another user already has an upload record for this storageId, OR
 * - Another user's expense already references this storageId.
 *
 * **Idempotent**: succeeds silently if the same user already registered.
 */
export const confirmUpload = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    // Reject if another user already claimed via uploads table
    const existingUpload = await getUploadRecord(ctx, args.storageId)
    if (existingUpload) {
      if (existingUpload.userId !== userId) {
        throw new Error('File already claimed by another user')
      }
      return // idempotent — same user already registered
    }

    // Reject if another user's expense already references this file
    // (covers pre-existing data that predates the uploads table)
    const existingExpense = await ctx.db
      .query('expenses')
      .withIndex('by_attachment', (q) =>
        q.eq('attachmentId', args.storageId),
      )
      .first()

    if (existingExpense && existingExpense.userId !== userId) {
      throw new Error('File already claimed by another user')
    }

    await ctx.db.insert('uploads', {
      storageId: args.storageId,
      userId,
      createdAt: Date.now(),
    })
  },
})

// ── Public queries ──────────────────────────────────────────────────────

/**
 * Get a temporary download URL for a file.
 *
 * Access is granted when the current user:
 * 1. Owns the upload record — covers the preview-before-save flow, OR
 * 2. Owns an expense that references the file — covers saved attachments.
 *
 * Cross-user conflicts are enforced at write time (`confirmUpload`,
 * `verifyAttachmentOwnership`), so the read path does not need to
 * re-verify them.
 */
export const getUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return null
    }

    // Path 1: user owns the upload record (preview before save)
    const upload = await getUploadRecord(ctx, args.storageId)
    if (upload?.userId === userId) {
      return await ctx.storage.getUrl(args.storageId)
    }

    // Path 2: user owns an expense referencing this file
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

// ── Delete ───────────────────────────────────────────────────────────────

/**
 * Delete a file from storage.
 *
 * Requires the file to be linked to an expense owned by the current user.
 * Also removes the corresponding upload record.
 */
export const deleteFile = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

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
    await deleteUploadRecord(ctx, args.storageId)
    return true
  },
})

// ── Cleanup cron ────────────────────────────────────────────────────────

/**
 * Clean up orphaned files and stale upload records.
 *
 * **Pass 1 — tracked orphans** (upload records older than 24 h):
 *   - If ANY expense still references the file → remove only the stale
 *     upload record (the file is in use).
 *   - Otherwise → delete the storage file and the upload record.
 *
 * **Pass 2 — untracked orphans** (storage files with no upload record):
 *   Catches files where the client uploaded successfully but
 *   `confirmUpload` never completed (tab closed, transient error, …).
 *   - If no expense references the file and it's older than 24 h → delete.
 *
 * Each pass processes up to {@link CLEANUP_BATCH_SIZE} items to stay
 * within Convex execution limits.  The daily cadence is sufficient for
 * normal volumes; backlogs drain over successive runs.
 */
export const cleanupOrphanedUploads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ORPHAN_TTL_MS
    let deletedFiles = 0

    // ── Pass 1 ──────────────────────────────────────────────────────
    const staleUploads = await ctx.db
      .query('uploads')
      .withIndex('by_created_at', (q) => q.lt('createdAt', cutoff))
      .take(CLEANUP_BATCH_SIZE)

    for (const upload of staleUploads) {
      const inUse = await isFileReferencedByExpense(ctx, upload.storageId)

      if (inUse) {
        // File is still attached to an expense — only remove the stale
        // upload record.
        await ctx.db.delete(upload._id)
      } else {
        // Truly orphaned — delete storage file + upload record.
        try {
          await ctx.storage.delete(upload.storageId)
        } catch (err) {
          console.warn(
            `Cleanup: could not delete storage file ${upload.storageId}:`,
            err,
          )
        }
        await ctx.db.delete(upload._id)
        deletedFiles++
      }
    }

    // ── Pass 2 ──────────────────────────────────────────────────────
    // Order oldest-first and pre-filter by cutoff so the batch only
    // contains files old enough to be candidates.
    const storageFiles = await ctx.db.system
      .query('_storage')
      .order('asc')
      .filter((q) => q.lt(q.field('_creationTime'), cutoff))
      .take(CLEANUP_BATCH_SIZE)

    for (const file of storageFiles) {
      // Skip files that have an upload record (handled in pass 1)
      const upload = await getUploadRecord(ctx, file._id)
      if (upload) continue

      // Skip files that are referenced by any expense
      const inUse = await isFileReferencedByExpense(ctx, file._id)
      if (inUse) continue

      try {
        await ctx.storage.delete(file._id)
      } catch (err) {
        console.warn(
          `Cleanup: could not delete untracked file ${file._id}:`,
          err,
        )
      }
      deletedFiles++
    }

    if (deletedFiles > 0) {
      console.log(`Cleanup: deleted ${deletedFiles} orphaned file(s)`)
    }
  },
})
