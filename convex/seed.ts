import { internalMutation, internalQuery } from './_generated/server'
import { authTables } from '@convex-dev/auth/server'
import { upsertMerchant } from './expenses'

// Predefined categories for work expenses
const PREDEFINED_CATEGORIES = [
  { name: 'Coworking', icon: '🏢' },
  { name: 'Pranzo di lavoro', icon: '🍝' },
  { name: 'Cena di lavoro', icon: '🍽️' },
]

/**
 * Seed the predefined categories if they don't exist
 */
export const seedCategories = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if predefined categories already exist
    const existingCategories = await ctx.db
      .query('categories')
      .filter((q) => q.eq(q.field('userId'), undefined))
      .collect()

    if (existingCategories.length > 0) {
      return { seeded: false, message: 'Categories already seeded' }
    }

    // Insert predefined categories
    for (const category of PREDEFINED_CATEGORIES) {
      await ctx.db.insert('categories', {
        name: category.name,
        icon: category.icon,
        userId: undefined,
      })
    }

    return { seeded: true, message: `Seeded ${PREDEFINED_CATEGORIES.length} categories` }
  },
})

/**
 * Check if categories are seeded
 */
export const checkSeeded = internalQuery({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db
      .query('categories')
      .filter((q) => q.eq(q.field('userId'), undefined))
      .collect()

    return {
      seeded: categories.length > 0,
      count: categories.length,
    }
  },
})

/**
 * One-time backfill: populate the merchants table from existing expenses.
 * Safe to run repeatedly — uses the same upsertMerchant helper so duplicates
 * and case variants are handled identically to the live create/update path.
 *
 * Run after deploying the merchants table:
 *   npx convex run seed:backfillMerchants
 */
export const backfillMerchants = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expenses = await ctx.db.query('expenses').collect()

    const seen = new Set<string>()
    for (const expense of expenses) {
      const key = `${expense.userId}:${expense.merchant.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      await upsertMerchant(ctx, expense.userId, expense.merchant)
    }

    return { processed: seen.size, message: `Backfilled ${seen.size} unique merchants` }
  },
})

// ============================================
// E2E Test Data Management
// ============================================

/**
 * Seed data for E2E tests
 * Creates predefined categories if they don't exist
 */
export const e2e = internalMutation({
  args: {},
  handler: async (ctx) => {
    // First, seed the predefined categories
    const existingCategories = await ctx.db
      .query('categories')
      .filter((q) => q.eq(q.field('userId'), undefined))
      .collect()

    if (existingCategories.length === 0) {
      for (const category of PREDEFINED_CATEGORIES) {
        await ctx.db.insert('categories', {
          name: category.name,
          icon: category.icon,
          userId: undefined,
        })
      }
    }

    return { success: true, message: 'E2E test data seeded' }
  },
})

/**
 * Clean up all E2E test data including auth users.
 * Removes expenses, user-created categories, and all auth-related records.
 * Predefined categories are preserved so the next seed is a no-op.
 */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Delete all expenses (and their attachments)
    const expenses = await ctx.db.query('expenses').collect()
    for (const expense of expenses) {
      if (expense.attachmentId) {
        try {
          await ctx.storage.delete(expense.attachmentId)
        } catch {
          // File may have already been deleted
        }
      }
      await ctx.db.delete(expense._id)
    }

    // Delete all upload tracking records and their storage files.
    // Storage files linked to expenses are already deleted above; this
    // catches orphaned uploads that were never attached to an expense.
    const uploads = await ctx.db.query('uploads').collect()
    for (const upload of uploads) {
      try {
        await ctx.storage.delete(upload.storageId)
      } catch {
        // File may have already been deleted above (linked to an expense)
      }
      await ctx.db.delete(upload._id)
    }

    // Delete all merchants
    const merchants = await ctx.db.query('merchants').collect()
    for (const merchant of merchants) {
      await ctx.db.delete(merchant._id)
    }

    // Delete user-created categories (keep predefined)
    const userCategories = await ctx.db
      .query('categories')
      .filter((q) => q.neq(q.field('userId'), undefined))
      .collect()
    for (const category of userCategories) {
      await ctx.db.delete(category._id)
    }

    // Delete all auth-related records dynamically derived from the
    // @convex-dev/auth schema — stays in sync if the library adds/removes tables.
    for (const table of Object.keys(authTables)) {
      // `as any` — authTables keys are defined by @convex-dev/auth and aren't
      // part of this project's generated Convex table-name union type.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await ctx.db.query(table as any).collect()
      for (const row of rows) {
        await ctx.db.delete(row._id)
      }
    }

    return { success: true, message: 'E2E test data and auth users cleaned up' }
  },
})
