import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { auth } from './auth'

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
 * Get a download URL for a file (verifies ownership)
 */
export const getUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return null
    }

    // Verify the storage ID belongs to an expense owned by the current user
    const expense = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('attachmentId'), args.storageId))
      .first()

    if (!expense) {
      return null
    }

    return await ctx.storage.getUrl(args.storageId)
  },
})

/**
 * Delete a file from storage (verifies ownership)
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
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('attachmentId'), args.storageId))
      .first()

    if (!expense) {
      throw new Error('File not found or not owned by current user')
    }

    await ctx.storage.delete(args.storageId)
    return true
  },
})
