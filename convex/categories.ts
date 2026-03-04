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
  const normalizedName = name.toLowerCase()

  const existing = await ctx.db
    .query('categories')
    .withIndex('by_user_and_normalized_name', (q) =>
      q.eq('userId', userId).eq('normalizedName', normalizedName),
    )
    .first()
  if (existing) return existing._id

  const predefined = await ctx.db
    .query('categories')
    .withIndex('by_user_and_normalized_name', (q) =>
      q.eq('userId', undefined).eq('normalizedName', normalizedName),
    )
    .first()
  if (predefined) return predefined._id

  return ctx.db.insert('categories', { name, normalizedName, userId })
}

/**
 * Resolve a category from either an existing ID or a new name.
 * When a name is provided, upserts and returns the resulting ID.
 * Verifies the caller owns (or can access) the resolved category.
 */
export async function resolveCategory(
  ctx: { db: MutationCtx['db'] },
  userId: Id<'users'>,
  args: { categoryId?: Id<'categories'>; newCategoryName?: string },
): Promise<Id<'categories'>> {
  let categoryId = args.categoryId
  if (!categoryId && args.newCategoryName) {
    categoryId = await upsertCategory(ctx, userId, args.newCategoryName)
  }
  if (!categoryId) {
    throw new Error('Category is required')
  }
  await verifyCategoryAccess(ctx, categoryId, userId)
  return categoryId
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
  const category = await ctx.db.get('categories', categoryId)
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

    // Get all predefined categories (userId is undefined) using index
    const predefinedCategories = await ctx.db
      .query('categories')
      .withIndex('by_user_and_name', (q) => q.eq('userId', undefined))
      .collect()

    // Get user's custom categories if authenticated
    let userCategories: typeof predefinedCategories = []
    if (userId) {
      userCategories = await ctx.db
        .query('categories')
        .withIndex('by_user_and_name', (q) => q.eq('userId', userId))
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
    const category = await ctx.db.get('categories', args.id)
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
    const normalizedName = name.toLowerCase()

    const existingUser = await ctx.db
      .query('categories')
      .withIndex('by_user_and_normalized_name', (q) =>
        q.eq('userId', userId).eq('normalizedName', normalizedName),
      )
      .first()
    if (existingUser) {
      throw new Error('Category already exists')
    }

    const existingPredefined = await ctx.db
      .query('categories')
      .withIndex('by_user_and_normalized_name', (q) =>
        q.eq('userId', undefined).eq('normalizedName', normalizedName),
      )
      .first()
    if (existingPredefined) {
      throw new Error('Category already exists')
    }

    const categoryId = await ctx.db.insert('categories', {
      name,
      normalizedName,
      userId,
      icon,
    })

    return categoryId
  },
})
