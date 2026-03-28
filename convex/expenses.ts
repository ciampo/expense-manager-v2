import { v } from 'convex/values'
import type { MutationCtx } from './_generated/server'
import { internalMutation, mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { auth } from './auth'
import { resolveCategory, upsertCategory, verifyCategoryAccess } from './categories'
import { upsertMerchant } from './merchants'
import { verifyAttachmentOwnership, deleteUploadRecord } from './storage'
import {
  normalizeMerchantName,
  validateExpenseFields,
  validateDraftUpdate,
  validateDraftCompletion,
} from './validation'

/**
 * Delete an auto-created user-custom category if no expenses reference it.
 *
 * Only categories with `source: "auto"` are eligible. Categories
 * explicitly created by the user (`source: "manual"`) and legacy rows
 * (`source: undefined`) are always preserved. Predefined categories
 * (no userId) are never deleted.
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
  if (category?.userId && category.userId === userId && category.source === 'auto') {
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

  if (!userExpenses.some((e) => e.merchant && normalizeMerchantName(e.merchant) === normalized)) {
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
    isDraft: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return { expenses: [], continueCursor: null, isDone: true }
    }

    const baseQuery =
      args.isDraft === undefined
        ? ctx.db.query('expenses').withIndex('by_user_and_date', (q) => q.eq('userId', userId))
        : ctx.db
            .query('expenses')
            .withIndex('by_user_and_draft_and_date', (q) =>
              q.eq('userId', userId).eq('isDraft', args.isDraft!),
            )

    const result = await baseQuery.order('desc').paginate({
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
      isDraft: false,
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
    if (existing.isDraft) {
      throw new Error('Cannot update a draft expense — use updateDraft or completeDraft instead')
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

    if (existing.categoryId && existing.categoryId !== categoryId) {
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

    if (expense.categoryId) {
      await cleanupOrphanedCategory(ctx, userId, expense.categoryId)
    }
    if (expense.merchant) {
      await cleanupOrphanedMerchant(ctx, userId, expense.merchant)
    }

    return args.id
  },
})

// ── Draft lifecycle ─────────────────────────────────────────────────────

/**
 * Create a draft expense from a single attachment.
 * Sets `isDraft: true` with only `userId`, `attachmentId`, and `createdAt`.
 */
export const createDraft = mutation({
  args: {
    attachmentId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    await verifyAttachmentOwnership(ctx, args.attachmentId, userId)

    return await ctx.db.insert('expenses', {
      userId,
      isDraft: true,
      attachmentId: args.attachmentId,
      createdAt: Date.now(),
    })
  },
})

/**
 * Create multiple draft expenses from a list of storage IDs.
 * Called by the REST API HTTP action — also creates upload records
 * for each file so ownership is tracked.
 */
export const createDraftsBulk = internalMutation({
  args: {
    storageIds: v.array(v.id('_storage')),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const expenseIds: Id<'expenses'>[] = []

    for (const storageId of args.storageIds) {
      await ctx.db.insert('uploads', {
        storageId,
        userId: args.userId,
        createdAt: Date.now(),
      })

      const expenseId = await ctx.db.insert('expenses', {
        userId: args.userId,
        isDraft: true,
        attachmentId: storageId,
        createdAt: Date.now(),
      })
      expenseIds.push(expenseId)
    }

    return expenseIds
  },
})

/**
 * Partial-field update for a draft expense.
 * Only the provided fields are validated and patched.
 * Rejects if the target expense is not a draft.
 */
export const updateDraft = mutation({
  args: {
    id: v.id('expenses'),
    date: v.optional(v.string()),
    merchant: v.optional(v.string()),
    amount: v.optional(v.number()),
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
    if (!existing.isDraft) {
      throw new Error('Expense is not a draft')
    }

    const validated = validateDraftUpdate({
      date: args.date,
      merchant: args.merchant,
      amount: args.amount,
      comment: args.comment,
    })

    const patch: Record<string, unknown> = {}
    if (validated.date !== undefined) patch.date = validated.date
    if (validated.merchant !== undefined) patch.merchant = validated.merchant
    if (validated.amount !== undefined) patch.amount = validated.amount
    if (validated.comment !== undefined) patch.comment = validated.comment

    if (args.categoryId !== undefined || args.newCategoryName !== undefined) {
      let categoryId: Id<'categories'> | undefined = args.categoryId
      if (!categoryId && args.newCategoryName) {
        categoryId = await upsertCategory(ctx, userId, args.newCategoryName)
      }
      if (categoryId) {
        await verifyCategoryAccess(ctx, categoryId, userId)
        patch.categoryId = categoryId
      }
    }

    if (args.attachmentId !== undefined && args.attachmentId !== existing.attachmentId) {
      await verifyAttachmentOwnership(ctx, args.attachmentId, userId)
      if (existing.attachmentId) {
        try {
          await ctx.storage.delete(existing.attachmentId)
        } catch {
          // File may have already been deleted
        }
        await deleteUploadRecord(ctx, existing.attachmentId)
      }
      patch.attachmentId = args.attachmentId
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch('expenses', args.id, patch)
    }

    return args.id
  },
})

/**
 * Complete a draft expense by providing all required fields.
 * Validates completeness, resolves category, upserts merchant,
 * and sets `isDraft: false`.
 */
export const completeDraft = mutation({
  args: {
    id: v.id('expenses'),
    date: v.string(),
    merchant: v.string(),
    amount: v.number(),
    categoryId: v.optional(v.id('categories')),
    newCategoryName: v.optional(v.string()),
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
    if (!existing.isDraft) {
      throw new Error('Expense is not a draft')
    }

    const { date, merchant, amount, comment } = validateDraftCompletion(args)
    const categoryId = await resolveCategory(ctx, userId, args)

    await ctx.db.patch('expenses', args.id, {
      isDraft: false,
      date,
      merchant,
      amount,
      categoryId,
      comment,
    })

    await upsertMerchant(ctx, userId, merchant)

    return args.id
  },
})

/**
 * Return the count of the current user's draft expenses.
 * Uses the `by_user_and_draft_and_date` index prefix.
 */
export const draftCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return 0
    }

    const drafts = await ctx.db
      .query('expenses')
      .withIndex('by_user_and_draft_and_date', (q) => q.eq('userId', userId).eq('isDraft', true))
      .collect()

    return drafts.length
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
