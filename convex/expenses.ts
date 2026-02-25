import { v } from 'convex/values'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { auth } from './auth'
import { upsertCategory, verifyCategoryAccess } from './categories'
import { verifyAttachmentOwnership, deleteUploadRecord } from './storage'
import { validateExpenseFields } from './validation'

/**
 * Insert a merchant name into the merchants table if it doesn't already exist
 * for the given user (case-insensitive). Keeps the original casing for display
 * while using a lowercased normalizedName for dedup.
 */
export async function upsertMerchant(
  ctx: { db: MutationCtx['db'] },
  userId: Id<'users'>,
  merchantName: string,
) {
  const normalizedName = merchantName.toLowerCase()
  const existing = await ctx.db
    .query('merchants')
    .withIndex('by_user_and_normalized_name', (q) =>
      q.eq('userId', userId).eq('normalizedName', normalizedName),
    )
    .first()
  if (!existing) {
    await ctx.db.insert('merchants', { name: merchantName, normalizedName, userId })
  }
}

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
 */
export const getMerchants = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return []
    }

    const merchants = await ctx.db
      .query('merchants')
      .withIndex('by_user_and_normalized_name', (q) => q.eq('userId', userId))
      .collect()

    return merchants.map((m) => m.name)
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
    categoryId: v.optional(v.id('categories')),
    newCategoryName: v.optional(v.string()),
    attachmentId: v.optional(v.id('_storage')),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    const { date, merchant, amount, comment } = validateExpenseFields(args)

    let categoryId = args.categoryId
    if (!categoryId && args.newCategoryName) {
      categoryId = await upsertCategory(ctx, userId, args.newCategoryName)
    }
    if (!categoryId) {
      throw new Error('Category is required')
    }
    await verifyCategoryAccess(ctx, categoryId, userId)

    if (args.attachmentId) {
      await verifyAttachmentOwnership(ctx, args.attachmentId, userId)
    }

    const expenseId = await ctx.db.insert('expenses', {
      userId,
      date,
      merchant,
      amount,
      categoryId,
      attachmentId: args.attachmentId,
      comment,
      createdAt: Date.now(),
    })

    await upsertMerchant(ctx, userId, merchant)

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
    categoryId: v.optional(v.id('categories')),
    newCategoryName: v.optional(v.string()),
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

    const { date, merchant, amount, comment } = validateExpenseFields(args)

    let categoryId = args.categoryId
    if (!categoryId && args.newCategoryName) {
      categoryId = await upsertCategory(ctx, userId, args.newCategoryName)
    }
    if (!categoryId) {
      throw new Error('Category is required')
    }
    await verifyCategoryAccess(ctx, categoryId, userId)

    if (args.attachmentId && args.attachmentId !== existing.attachmentId) {
      await verifyAttachmentOwnership(ctx, args.attachmentId, userId)
    }

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
      date,
      merchant,
      amount,
      categoryId,
      attachmentId: args.attachmentId,
      comment,
    })

    await upsertMerchant(ctx, userId, merchant)

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
