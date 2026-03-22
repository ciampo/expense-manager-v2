import { v } from 'convex/values'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internalMutation, mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { auth } from './auth'
import { validateCategoryFields } from './validation'

/**
 * Find a category by normalized name, with a fallback for legacy rows that
 * predate the normalizedName field. When a legacy row is found by exact name,
 * its normalizedName is lazily backfilled.
 */
async function findCategory(
  ctx: { db: MutationCtx['db'] },
  userId: Id<'users'> | undefined,
  name: string,
  normalizedName: string,
) {
  const byNormalized = await ctx.db
    .query('categories')
    .withIndex('by_user_and_normalized_name', (q) =>
      q.eq('userId', userId).eq('normalizedName', normalizedName),
    )
    .first()
  if (byNormalized) return byNormalized

  const byExactName = await ctx.db
    .query('categories')
    .withIndex('by_user_and_name', (q) => q.eq('userId', userId).eq('name', name))
    .first()
  if (byExactName && !byExactName.normalizedName) {
    await ctx.db.patch('categories', byExactName._id, {
      normalizedName: byExactName.name.toLowerCase(),
    })
  }
  return byExactName
}

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

  const existing = await findCategory(ctx, userId, name, normalizedName)
  if (existing) return existing._id

  const predefined = await findCategory(ctx, undefined, name, normalizedName)
  if (predefined) return predefined._id

  return ctx.db.insert('categories', { name, normalizedName, userId, source: 'auto' })
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

    if (await findCategory(ctx, userId, name, normalizedName)) {
      throw new Error('Category already exists')
    }

    if (await findCategory(ctx, undefined, name, normalizedName)) {
      throw new Error('Category already exists')
    }

    const categoryId = await ctx.db.insert('categories', {
      name,
      normalizedName,
      userId,
      icon,
      source: 'manual',
    })

    return categoryId
  },
})

/**
 * List all categories with expense counts (for the settings page).
 * Returns predefined categories first, then user-custom categories.
 */
export const listWithCounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx)

    const predefined = await ctx.db
      .query('categories')
      .withIndex('by_user_and_name', (q) => q.eq('userId', undefined))
      .collect()

    let userCategories: typeof predefined = []
    if (userId) {
      userCategories = await ctx.db
        .query('categories')
        .withIndex('by_user_and_name', (q) => q.eq('userId', userId))
        .collect()
    }

    const allCategories = [
      ...predefined.map((c) => ({ ...c, isPredefined: true })),
      ...userCategories.map((c) => ({ ...c, isPredefined: false })),
    ]

    const counts = new Map<string, number>()
    if (userId) {
      const allExpenses = await ctx.db
        .query('expenses')
        .withIndex('by_user_and_date', (q) => q.eq('userId', userId))
        .collect()
      for (const expense of allExpenses) {
        counts.set(expense.categoryId, (counts.get(expense.categoryId) ?? 0) + 1)
      }
    }

    return allCategories
      .map((c) => ({
        ...c,
        expenseCount: counts.get(c._id) ?? 0,
      }))
      .sort((a, b) => {
        if (a.isPredefined !== b.isPredefined) return a.isPredefined ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  },
})

/**
 * Rename a user-custom category. Predefined categories cannot be renamed.
 */
export const rename = mutation({
  args: {
    id: v.id('categories'),
    newName: v.string(),
    newIcon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    const category = await ctx.db.get('categories', args.id)
    if (!category) throw new Error('Category not found')
    if (!category.userId || category.userId !== userId) {
      throw new Error('Cannot modify this category')
    }

    const { name, icon } = validateCategoryFields({
      name: args.newName,
      icon: args.newIcon,
    })
    const normalizedName = name.toLowerCase()

    if (normalizedName !== category.normalizedName) {
      if (await findCategory(ctx, userId, name, normalizedName)) {
        throw new Error('Category already exists')
      }
      if (await findCategory(ctx, undefined, name, normalizedName)) {
        throw new Error('Category already exists')
      }
    }

    await ctx.db.patch('categories', args.id, { name, normalizedName, icon })
    return args.id
  },
})

/**
 * Delete a user-custom category that has no expenses referencing it.
 * Predefined categories cannot be deleted.
 */
export const remove = mutation({
  args: { id: v.id('categories') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    const category = await ctx.db.get('categories', args.id)
    if (!category) throw new Error('Category not found')
    if (!category.userId || category.userId !== userId) {
      throw new Error('Cannot delete this category')
    }

    const referencing = await ctx.db
      .query('expenses')
      .withIndex('by_category', (q) => q.eq('categoryId', args.id))
      .first()
    if (referencing) {
      throw new Error('Cannot delete category that is used by expenses')
    }

    await ctx.db.delete('categories', args.id)
    return args.id
  },
})

// ── Cleanup cron ────────────────────────────────────────────────────────

const CLEANUP_BATCH_SIZE = 100

/**
 * Delete auto-created user-custom categories not referenced by any expense.
 *
 * Only categories with `source: "auto"` (implicitly created during expense
 * upsert) are eligible. Categories explicitly created by the user via
 * Settings (`source: "manual"`) and legacy rows (`source: undefined`) are
 * always preserved. Predefined categories are never removed.
 *
 * Scans auto-created user-custom categories and deletes up to
 * {@link CLEANUP_BATCH_SIZE} orphans per run.
 */
export const cleanupOrphanedCategories = internalMutation({
  args: {},
  handler: async (ctx) => {
    const autoCategories = await ctx.db
      .query('categories')
      .filter((q) => q.and(q.neq(q.field('userId'), undefined), q.eq(q.field('source'), 'auto')))
      .collect()

    if (autoCategories.length === 0) return

    const allExpenses = await ctx.db.query('expenses').collect()
    const referencedCategoryIds = new Set(allExpenses.map((e) => e.categoryId))

    let deleted = 0
    for (const category of autoCategories) {
      if (deleted >= CLEANUP_BATCH_SIZE) break
      if (!referencedCategoryIds.has(category._id)) {
        await ctx.db.delete('categories', category._id)
        deleted++
      }
    }

    if (deleted > 0) {
      console.log(
        `Cleanup: deleted ${deleted} orphaned ${deleted === 1 ? 'category' : 'categories'}`,
      )
    }
  },
})
