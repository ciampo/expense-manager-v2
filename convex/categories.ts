import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { auth } from './auth'
import { validateCategoryFields } from './validation'

/**
 * Find an existing category by name or create a new one for the user.
 * Checks both user-created and predefined categories for dedup.
 * Returns the category ID in all cases.
 */
export async function upsertCategory(
  ctx: { db: MutationCtx['db'] },
  userId: Id<'users'>,
  categoryName: string,
): Promise<Id<'categories'>> {
  const { name } = validateCategoryFields({ name: categoryName })

  const existing = await ctx.db
    .query('categories')
    .withIndex('by_user_and_name', (q) => q.eq('userId', userId).eq('name', name))
    .first()
  if (existing) return existing._id

  const predefined = await ctx.db
    .query('categories')
    .withIndex('by_user_and_name', (q) => q.eq('userId', undefined).eq('name', name))
    .first()
  if (predefined) return predefined._id

  return ctx.db.insert('categories', { name, userId })
}

/**
 * Verify that a category is accessible to the given user.
 * A category is accessible if it is predefined (no userId) or owned by the user.
 * Throws if the category doesn't exist or belongs to another user.
 */
export async function verifyCategoryAccess(
  ctx: { db: QueryCtx['db'] },
  categoryId: Id<'categories'>,
  userId: Id<'users'>,
) {
  const category = await ctx.db.get(categoryId)
  if (!category) {
    throw new Error('Category not found')
  }
  if (category.userId !== undefined && category.userId !== userId) {
    throw new Error('Category not found')
  }
}

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

    const { name, icon } = validateCategoryFields(args)

    const existing = await ctx.db
      .query('categories')
      .withIndex('by_user_and_name', (q) => q.eq('userId', userId).eq('name', name))
      .first()

    if (existing) {
      throw new Error('Category already exists')
    }

    const predefined = await ctx.db
      .query('categories')
      .withIndex('by_user_and_name', (q) => q.eq('userId', undefined).eq('name', name))
      .first()

    if (predefined) {
      throw new Error('Category already exists')
    }

    const categoryId = await ctx.db.insert('categories', {
      name,
      userId,
      icon,
    })

    return categoryId
  },
})
