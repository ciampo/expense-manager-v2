import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { auth } from './auth'

/**
 * List all categories (predefined + user's custom)
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx)

    // Get all predefined categories (userId is undefined)
    const predefinedCategories = await ctx.db
      .query('categories')
      .filter((q) => q.eq(q.field('userId'), undefined))
      .collect()

    // Get user's custom categories if authenticated
    let userCategories: typeof predefinedCategories = []
    if (userId) {
      userCategories = await ctx.db
        .query('categories')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect()
    }

    // Return predefined first, then user categories
    return [
      ...predefinedCategories.map((c) => ({ ...c, isPredefined: true })),
      ...userCategories.map((c) => ({ ...c, isPredefined: false })),
    ]
  },
})

/**
 * Get a single category by ID.
 * Predefined categories (no userId) are accessible to anyone.
 * Custom categories are only accessible to their owner.
 */
export const get = query({
  args: { id: v.id('categories') },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.id)
    if (!category) {
      return null
    }

    // Predefined categories are public
    if (!category.userId) {
      return category
    }

    // Custom categories require ownership
    const userId = await auth.getUserId(ctx)
    if (!userId || category.userId !== userId) {
      return null
    }

    return category
  },
})

/**
 * Create a custom category for the current user
 */
export const create = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      throw new Error('Not authenticated')
    }

    // Check if category with same name already exists for this user
    const existing = await ctx.db
      .query('categories')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('name'), args.name))
      .first()

    if (existing) {
      throw new Error('Category already exists')
    }

    // Also check predefined categories
    const predefined = await ctx.db
      .query('categories')
      .filter((q) =>
        q.and(
          q.eq(q.field('userId'), undefined),
          q.eq(q.field('name'), args.name)
        )
      )
      .first()

    if (predefined) {
      throw new Error('Category already exists')
    }

    const categoryId = await ctx.db.insert('categories', {
      name: args.name,
      userId,
      icon: args.icon,
    })

    return categoryId
  },
})
