import { v } from 'convex/values'
import type { MutationCtx } from './_generated/server'
import { internalMutation, mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { auth } from './auth'

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
 * List all merchants for the current user with expense counts.
 */
export const listWithCounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) return []

    const merchants = await ctx.db
      .query('merchants')
      .withIndex('by_user_and_normalized_name', (q) => q.eq('userId', userId))
      .collect()

    const allExpenses = await ctx.db
      .query('expenses')
      .withIndex('by_user_and_date', (q) => q.eq('userId', userId))
      .collect()

    const countMap = new Map<string, number>()
    for (const expense of allExpenses) {
      const normalized = expense.merchant.toLowerCase()
      countMap.set(normalized, (countMap.get(normalized) ?? 0) + 1)
    }

    return merchants
      .map((m) => ({
        ...m,
        expenseCount: countMap.get(m.normalizedName) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
})

/**
 * Rename a merchant. Updates the merchants table entry and all
 * expenses that reference the old name (case-insensitive).
 */
export const rename = mutation({
  args: {
    id: v.id('merchants'),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    const merchant = await ctx.db.get('merchants', args.id)
    if (!merchant || merchant.userId !== userId) {
      throw new Error('Merchant not found')
    }

    const newName = args.newName.trim()
    if (!newName) throw new Error('Merchant name is required')

    const newNormalizedName = newName.toLowerCase()

    if (newNormalizedName !== merchant.normalizedName) {
      const duplicate = await ctx.db
        .query('merchants')
        .withIndex('by_user_and_normalized_name', (q) =>
          q.eq('userId', userId).eq('normalizedName', newNormalizedName),
        )
        .first()
      if (duplicate) throw new Error('A merchant with this name already exists')
    }

    const oldNormalized = merchant.normalizedName
    const userExpenses = await ctx.db
      .query('expenses')
      .withIndex('by_user_and_date', (q) => q.eq('userId', userId))
      .collect()

    for (const expense of userExpenses) {
      if (expense.merchant.toLowerCase() === oldNormalized) {
        await ctx.db.patch('expenses', expense._id, { merchant: newName })
      }
    }

    await ctx.db.patch('merchants', args.id, {
      name: newName,
      normalizedName: newNormalizedName,
    })

    return args.id
  },
})

/**
 * Delete a merchant that has no expenses referencing it.
 */
export const remove = mutation({
  args: { id: v.id('merchants') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    const merchant = await ctx.db.get('merchants', args.id)
    if (!merchant || merchant.userId !== userId) {
      throw new Error('Merchant not found')
    }

    const userExpenses = await ctx.db
      .query('expenses')
      .withIndex('by_user_and_date', (q) => q.eq('userId', userId))
      .collect()

    const hasReference = userExpenses.some(
      (e) => e.merchant.toLowerCase() === merchant.normalizedName,
    )
    if (hasReference) {
      throw new Error('Cannot delete merchant that is used by expenses')
    }

    await ctx.db.delete('merchants', args.id)
    return args.id
  },
})

// ── Cleanup cron ────────────────────────────────────────────────────────

const CLEANUP_BATCH_SIZE = 100

/**
 * Delete merchant records that are not referenced by any expense.
 * Processes up to {@link CLEANUP_BATCH_SIZE} merchants per run.
 */
export const cleanupOrphanedMerchants = internalMutation({
  args: {},
  handler: async (ctx) => {
    const merchants = await ctx.db.query('merchants').take(CLEANUP_BATCH_SIZE)

    let deleted = 0
    for (const merchant of merchants) {
      const userExpenses = await ctx.db
        .query('expenses')
        .withIndex('by_user_and_date', (q) => q.eq('userId', merchant.userId))
        .collect()

      const hasReference = userExpenses.some(
        (e) => e.merchant.toLowerCase() === merchant.normalizedName,
      )

      if (!hasReference) {
        await ctx.db.delete('merchants', merchant._id)
        deleted++
      }
    }

    if (deleted > 0) {
      console.log(`Cleanup: deleted ${deleted} orphaned merchant(s)`)
    }
  },
})
