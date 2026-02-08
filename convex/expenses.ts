import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { auth } from './auth'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function validateExpenseFields(args: {
  date: string
  merchant: string
  amount: number
  comment?: string
}) {
  if (!isValidDate(args.date)) {
    throw new Error('Invalid date. Expected a valid YYYY-MM-DD date.')
  }
  if (!Number.isInteger(args.amount) || args.amount <= 0) {
    throw new Error('Amount must be a positive integer (cents).')
  }
  const trimmedMerchant = args.merchant.trim()
  if (!trimmedMerchant) {
    throw new Error('Merchant name is required.')
  }
  if (trimmedMerchant.length > 200) {
    throw new Error('Merchant name must be 200 characters or less.')
  }
  if (args.comment !== undefined && args.comment.trim().length > 1000) {
    throw new Error('Comment must be 1000 characters or less.')
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
 * Get unique merchant names for autocomplete
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
      const upload = await ctx.db
        .query('uploads')
        .withIndex('by_storage_id', (q) =>
          q.eq('storageId', args.attachmentId!),
        )
        .first()

      if (!upload || upload.userId !== userId) {
        throw new Error('Attachment not found or not owned by current user')
      }
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
      const upload = await ctx.db
        .query('uploads')
        .withIndex('by_storage_id', (q) =>
          q.eq('storageId', args.attachmentId!),
        )
        .first()

      if (!upload || upload.userId !== userId) {
        throw new Error('Attachment not found or not owned by current user')
      }
    }

    // If attachment changed and old one exists, delete it
    if (existing.attachmentId && existing.attachmentId !== args.attachmentId) {
      await ctx.storage.delete(existing.attachmentId)
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

    // Delete attachment if exists
    if (expense.attachmentId) {
      await ctx.storage.delete(expense.attachmentId)
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
      await ctx.storage.delete(expense.attachmentId)
      await ctx.db.patch(args.id, { attachmentId: undefined })
    }

    return args.id
  },
})
