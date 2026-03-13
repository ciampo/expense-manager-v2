import { v } from 'convex/values'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { auth } from './auth'
import { resolveCategory } from './categories'
import { upsertMerchant } from './merchants'
import { verifyAttachmentOwnership, deleteUploadRecord } from './storage'
import { normalizeMerchantName, validateExpenseFields } from './validation'

/**
 * Delete a user-custom category if no expenses reference it.
 * Predefined categories (no userId) are never deleted.
 * Only deletes categories owned by the given user.
 */
async function cleanupOrphanedCategory(
  ctx: { db: MutationCtx['db'] },
  userId: Id<'users'>,
  categoryId: Id<'categories'>,
) {
  const referencing = await ctx.db
    .query('expenses')
    .withIndex('by_category', (q) => q.eq('categoryId', categoryId))
    .first()
  if (referencing) return

  const category = await ctx.db.get('categories', categoryId)
  if (category?.userId && category.userId === userId) {
    await ctx.db.delete('categories', category._id)
  }
}

/**
 * Delete a merchant record if no remaining expenses use the same
 * merchant name (case-insensitive).
 */
async function cleanupOrphanedMerchant(
  ctx: { db: MutationCtx['db'] },
  userId: Id<'users'>,
  merchantName: string,
) {
  const normalized = normalizeMerchantName(merchantName)
  const merchant = await ctx.db
    .query('merchants')
    .withIndex('by_user_and_normalized_name', (q) =>
      q.eq('userId', userId).eq('normalizedName', normalized),
    )
    .first()
  if (!merchant) return

  const userExpenses = await ctx.db
    .query('expenses')
    .withIndex('by_user_and_date', (q) => q.eq('userId', userId))
    .collect()

  if (!userExpenses.some((e) => normalizeMerchantName(e.merchant) === normalized)) {
    await ctx.db.delete('merchants', merchant._id)
  }
}

/**
 * List expenses for the current user, sorted by date (most recent first).
 * Supports cursor-based pagination; defaults to 50 items per page (max 100).
 *
 * Returns `{ expenses, continueCursor, isDone }`.
 */
export const list = query({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return { expenses: [], continueCursor: null, isDone: true }
    }

    const result = await ctx.db
      .query('expenses')
      .withIndex('by_user_and_date', (q) => q.eq('userId', userId))
      .order('desc')
      .paginate({
        numItems: Math.max(1, Math.min(Math.trunc(args.limit ?? 50), 100)),
        cursor: args.cursor ?? null,
      })

    return {
      expenses: result.page,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    }
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

    const expense = await ctx.db.get('expenses', args.id)
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
    const categoryId = await resolveCategory(ctx, userId, args)

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

    const existing = await ctx.db.get('expenses', args.id)
    if (!existing || existing.userId !== userId) {
      throw new Error('Expense not found')
    }

    const { date, merchant, amount, comment } = validateExpenseFields(args)
    const categoryId = await resolveCategory(ctx, userId, args)

    // Only modify attachment when the client explicitly provides the field.
    // Convex strips `undefined` from v.optional args, so the comparison
    // is true only when a valid Id<'_storage'> was sent.
    if (args.attachmentId !== undefined && args.attachmentId !== existing.attachmentId) {
      await verifyAttachmentOwnership(ctx, args.attachmentId, userId)
      // Storage deletion is best-effort — if the file is already gone
      // (e.g. cleaned up by the cron), the update should still proceed.
      if (existing.attachmentId) {
        try {
          await ctx.storage.delete(existing.attachmentId)
        } catch {
          // File may have already been deleted
        }
        await deleteUploadRecord(ctx, existing.attachmentId)
      }
    }

    await ctx.db.patch('expenses', args.id, {
      date,
      merchant,
      amount,
      categoryId,
      comment,
      ...(args.attachmentId !== undefined ? { attachmentId: args.attachmentId } : {}),
    })

    await upsertMerchant(ctx, userId, merchant)

    if (existing.categoryId !== categoryId) {
      await cleanupOrphanedCategory(ctx, userId, existing.categoryId)
    }
    // Merchant cleanup is intentionally deferred to the daily cron.
    // Keeping the old merchant record available preserves autocomplete
    // suggestions for future expenses.

    return args.id
  },
})

/**
 * Delete an expense and clean up orphaned attachment, category, and merchant.
 */
export const remove = mutation({
  args: { id: v.id('expenses') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    const expense = await ctx.db.get('expenses', args.id)
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

    await ctx.db.delete('expenses', args.id)

    await cleanupOrphanedCategory(ctx, userId, expense.categoryId)
    await cleanupOrphanedMerchant(ctx, userId, expense.merchant)

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

    const expense = await ctx.db.get('expenses', args.id)
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
      await ctx.db.patch('expenses', args.id, { attachmentId: undefined })
    }

    return args.id
  },
})
