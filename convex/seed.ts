import type { MutationCtx } from './_generated/server'
import { internalMutation, internalQuery } from './_generated/server'
import { authTables } from '@convex-dev/auth/server'
import { upsertMerchant } from './merchants'
import { normalizeMerchantName } from './validation'

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
    const existingCategories = await ctx.db
      .query('categories')
      .withIndex('by_user_and_name', (q) => q.eq('userId', undefined))
      .collect()

    if (existingCategories.length > 0) {
      return { seeded: false, message: 'Categories already seeded' }
    }

    for (const category of PREDEFINED_CATEGORIES) {
      await ctx.db.insert('categories', {
        name: category.name,
        normalizedName: category.name.toLowerCase(),
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
      .withIndex('by_user_and_name', (q) => q.eq('userId', undefined))
      .collect()

    return {
      seeded: categories.length > 0,
      count: categories.length,
    }
  },
})

// ============================================
// Backfill migrations
// ============================================
//
// Each migration is idempotent and safe to run multiple times. Migrations
// that can short-circuit (e.g., merchants backfill) include an O(1)
// precondition check; others (e.g., category normalizedName) scan existing
// rows but only patch those that still need updating.
// Called automatically by `postDeploy` after every Convex deploy (CI) and
// via `pnpm migrate` (local dev). The standalone mutations below remain
// available for targeted manual runs: `npx convex run seed:<name>`.

async function runBackfillMerchants(ctx: MutationCtx) {
  const alreadyPopulated = await ctx.db.query('merchants').first()
  if (alreadyPopulated) {
    return { processed: 0, message: 'Merchants table already populated, skipping backfill' }
  }

  const expenses = await ctx.db.query('expenses').collect()

  const seen = new Set<string>()
  for (const expense of expenses) {
    const key = `${expense.userId}:${normalizeMerchantName(expense.merchant)}`
    if (seen.has(key)) continue
    seen.add(key)
    await upsertMerchant(ctx, expense.userId, expense.merchant)
  }

  return { processed: seen.size, message: `Backfilled ${seen.size} unique merchants` }
}

async function runBackfillCategoryNormalizedName(ctx: MutationCtx) {
  const categories = await ctx.db.query('categories').collect()

  let updated = 0
  for (const category of categories) {
    if (category.normalizedName === undefined) {
      await ctx.db.patch('categories', category._id, {
        normalizedName: category.name.toLowerCase(),
      })
      updated++
    }
  }

  return { updated, total: categories.length, message: `Backfilled ${updated} categories` }
}

/** Populate the merchants table from existing expenses. */
export const backfillMerchants = internalMutation({
  args: {},
  handler: async (ctx) => runBackfillMerchants(ctx),
})

/** Populate normalizedName for all existing categories. */
export const backfillCategoryNormalizedName = internalMutation({
  args: {},
  handler: async (ctx) => runBackfillCategoryNormalizedName(ctx),
})

/**
 * Run all pending migrations. Called automatically after every
 * `npx convex deploy` in CI (deploy.yml, test-e2e.yml) and available
 * locally via `pnpm migrate`.
 */
export const postDeploy = internalMutation({
  args: {},
  handler: async (ctx) => {
    const merchants = await runBackfillMerchants(ctx)
    const categories = await runBackfillCategoryNormalizedName(ctx)
    return { merchants, categories }
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
    const existingCategories = await ctx.db
      .query('categories')
      .withIndex('by_user_and_name', (q) => q.eq('userId', undefined))
      .collect()

    if (existingCategories.length === 0) {
      for (const category of PREDEFINED_CATEGORIES) {
        await ctx.db.insert('categories', {
          name: category.name,
          normalizedName: category.name.toLowerCase(),
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
      await ctx.db.delete('expenses', expense._id)
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
      await ctx.db.delete('uploads', upload._id)
    }

    // Delete all merchants
    const merchants = await ctx.db.query('merchants').collect()
    for (const merchant of merchants) {
      await ctx.db.delete('merchants', merchant._id)
    }

    // Delete user-created categories (keep predefined).
    // No index covers userId != undefined, so filter is appropriate here.
    const userCategories = await ctx.db
      .query('categories')
      .filter((q) => q.neq(q.field('userId'), undefined))
      .collect()
    for (const category of userCategories) {
      await ctx.db.delete('categories', category._id)
    }

    // Delete all auth-related records dynamically derived from the
    // @convex-dev/auth schema — stays in sync if the library adds/removes tables.
    // `as any` — authTables keys are defined by @convex-dev/auth and aren't
    // part of this project's generated Convex table-name union type.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    for (const table of Object.keys(authTables)) {
      const rows = await ctx.db.query(table as any).collect()
      for (const row of rows) {
        await ctx.db.delete(table as any, row._id)
      }
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return { success: true, message: 'E2E test data and auth users cleaned up' }
  },
})
