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
 * Clean up E2E test data
 * Removes all test data from the database
 */
export const cleanup = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all expenses
    const expenses = await ctx.db.query('expenses').collect()
    for (const expense of expenses) {
      // Delete attachment if exists
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

    return { success: true, message: 'E2E test data cleaned up' }
  },
})
