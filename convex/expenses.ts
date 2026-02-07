import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { auth } from './auth'
import { verifyAttachmentOwnership, deleteUploadRecord } from './storage'
import { validateExpenseFields } from './validation'

/**
 * List all expenses for the current user, sorted by date (most recent first)
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return []
    }

    const expenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    // Sort by date descending (most recent first)
    return expenses.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date)
      if (dateCompare !== 0) return dateCompare
      // If same date, sort by createdAt descending
      return b.createdAt - a.createdAt
    })
  },
})

/**
 * Get a single expense by ID
 */
export const get = query({
  args: { id: v.id('expenses') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return null
    }

    const expense = await ctx.db.get(args.id)
    if (!expense || expense.userId !== userId) {
      return null
    }

    return expense
  },
})

/**
 * Get unique merchant names for autocomplete.
 *
 * NOTE: This fetches all user expenses to extract merchant names, making it
 * O(n) on the total number of expenses. Convex does not support projection
 * queries (selecting specific fields only), so the full document is read.
 * For users with a very large number of expenses, consider introducing a
 * dedicated `merchants` table that is updated on expense create/update.
 */
export const getMerchants = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return []
    }

    const expenses = await ctx.db
      .query('expenses')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    // Get unique merchant names
    const merchantSet = new Set(expenses.map((e) => e.merchant))
    return Array.from(merchantSet).sort()
  },
})

/**
 * Create a new expense
 */
export const create = mutation({
  args: {
    date: v.string(),
    merchant: v.string(),
    amount: v.number(),
    categoryId: v.id('categories'),
    attachmentId: v.optional(v.id('_storage')),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    validateExpenseFields(args)

    // Verify the user owns the uploaded file
    if (args.attachmentId) {
      await verifyAttachmentOwnership(ctx, args.attachmentId, userId)
    }

    const expenseId = await ctx.db.insert('expenses', {
      userId,
      date: args.date,
      merchant: args.merchant.trim(),
      amount: args.amount,
      categoryId: args.categoryId,
      attachmentId: args.attachmentId,
      // Empty/whitespace-only comments are stored as undefined (absent)
      comment: args.comment?.trim() || undefined,
      createdAt: Date.now(),
    })

    return expenseId
  },
})

/**
 * Update an existing expense
 */
export const update = mutation({
  args: {
    id: v.id('expenses'),
    date: v.string(),
    merchant: v.string(),
    amount: v.number(),
    categoryId: v.id('categories'),
    attachmentId: v.optional(v.id('_storage')),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    const existing = await ctx.db.get(args.id)
    if (!existing || existing.userId !== userId) {
      throw new Error('Expense not found')
    }

    validateExpenseFields(args)

    // If the attachment is changing, verify the user owns the new upload
    if (args.attachmentId && args.attachmentId !== existing.attachmentId) {
      await verifyAttachmentOwnership(ctx, args.attachmentId, userId)
    }

    // If attachment changed and old one exists, clean it up.
    // Storage deletion is best-effort — if the file is already gone
    // (e.g. cleaned up by the cron), the update should still proceed.
    if (existing.attachmentId && existing.attachmentId !== args.attachmentId) {
      try {
        await ctx.storage.delete(existing.attachmentId)
      } catch {
        // File may have already been deleted
      }
      await deleteUploadRecord(ctx, existing.attachmentId)
    }

    await ctx.db.patch(args.id, {
      date: args.date,
      merchant: args.merchant.trim(),
      amount: args.amount,
      categoryId: args.categoryId,
      attachmentId: args.attachmentId,
      // Empty/whitespace-only comments are stored as undefined (absent)
      comment: args.comment?.trim() || undefined,
    })

    return args.id
  },
})

/**
 * Delete an expense
 */
export const remove = mutation({
  args: { id: v.id('expenses') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    const expense = await ctx.db.get(args.id)
    if (!expense || expense.userId !== userId) {
      throw new Error('Expense not found')
    }

    // Clean up attachment if it exists. Storage deletion is best-effort
    // so a missing file doesn't block expense deletion.
    if (expense.attachmentId) {
      try {
        await ctx.storage.delete(expense.attachmentId)
      } catch {
        // File may have already been deleted
      }
      await deleteUploadRecord(ctx, expense.attachmentId)
    }

    await ctx.db.delete(args.id)
    return args.id
  },
})

/**
 * Remove attachment from an expense
 */
export const removeAttachment = mutation({
  args: { id: v.id('expenses') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    const expense = await ctx.db.get(args.id)
    if (!expense || expense.userId !== userId) {
      throw new Error('Expense not found')
    }

    if (expense.attachmentId) {
      try {
        await ctx.storage.delete(expense.attachmentId)
      } catch {
        // File may have already been deleted
      }
      await deleteUploadRecord(ctx, expense.attachmentId)
      await ctx.db.patch(args.id, { attachmentId: undefined })
    }

    return args.id
  },
})
