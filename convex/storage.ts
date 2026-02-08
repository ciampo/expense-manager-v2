import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { auth } from './auth'

const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

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

    // Reject if another user already claimed this storageId
    const existing = await ctx.db
      .query('uploads')
      .withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId))
      .first()

    if (existing && existing.userId !== userId) {
      throw new Error('File already claimed by another user')
    }

    // Idempotent: skip if the same user already registered this upload
    if (existing) {
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

    // Check 1: user owns the upload record (covers preview-before-save)
    const upload = await ctx.db
      .query('uploads')
      .withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId))
      .first()

    if (upload && upload.userId === userId) {
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
    const upload = await ctx.db
      .query('uploads')
      .withIndex('by_storage_id', (q) => q.eq('storageId', args.storageId))
      .first()

    if (upload) {
      await ctx.db.delete(upload._id)
    }

    return true
  },
})

/**
 * Delete orphaned upload records (and their storage files) that are older
 * than 24 hours and not referenced by any expense.
 *
 * Called by the daily cron defined in crons.ts.
 */
export const cleanupOrphanedUploads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ORPHAN_TTL_MS

    // Fetch upload records older than the TTL
    const oldUploads = await ctx.db
      .query('uploads')
      .withIndex('by_created_at', (q) => q.lt('createdAt', cutoff))
      .collect()

    let deleted = 0
    for (const upload of oldUploads) {
      // Check if any expense references this file
      const expense = await ctx.db
        .query('expenses')
        .withIndex('by_user_and_attachment', (q) =>
          q.eq('userId', upload.userId).eq('attachmentId', upload.storageId),
        )
        .first()

      if (!expense) {
        // Orphaned: delete the storage file and the upload record
        await ctx.storage.delete(upload.storageId)
        await ctx.db.delete(upload._id)
        deleted++
      }
    }

    if (deleted > 0) {
      console.log(`Cleaned up ${deleted} orphaned upload(s)`)
    }
  },
})
