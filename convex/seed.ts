import { mutation, query } from './_generated/server'

// Predefined categories for work expenses
const PREDEFINED_CATEGORIES = [
  { name: 'Coworking', icon: '🏢' },
  { name: 'Pranzo di lavoro', icon: '🍝' },
  { name: 'Cena di lavoro', icon: '🍽️' },
]

/**
 * Seed the predefined categories if they don't exist
 */
export const seedCategories = mutation({
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
export const checkSeeded = query({
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

// ============================================
// E2E Test Data Management
// ============================================

/**
 * Seed data for E2E tests
 * Creates predefined categories if they don't exist
 */
export const e2e = mutation({
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
export const cleanup = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all expenses (and their attachments)
    const expenses = await ctx.db.query('expenses').collect()
    for (const expense of expenses) {
      if (expense.attachmentId) {
        await ctx.storage.delete(expense.attachmentId)
      }
      await ctx.db.delete(expense._id)
    }

    // Delete user-created categories (keep predefined)
    const userCategories = await ctx.db
      .query('categories')
      .filter((q) => q.neq(q.field('userId'), undefined))
      .collect()
    for (const category of userCategories) {
      await ctx.db.delete(category._id)
    }

    // Delete all auth-related records (order matters: sessions/tokens
    // reference accounts/users, so delete dependents first)
    const authTables = [
      'authRefreshTokens',
      'authVerificationCodes',
      'authVerifiers',
      'authRateLimits',
      'authSessions',
      'authAccounts',
      'users',
    ] as const

    for (const table of authTables) {
      const rows = await ctx.db.query(table).collect()
      for (const row of rows) {
        await ctx.db.delete(row._id)
      }
    }

    return { success: true, message: 'E2E test data and auth users cleaned up' }
  },
})
