// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'
import { upsertCategory } from './categories'
import { setupAuthenticatedUser } from './testHelpers'

const modules = import.meta.glob('./**/*.ts')

async function insertCategory(
  t: ReturnType<typeof convexTest>,
  fields: { name: string; userId?: Id<'users'>; icon?: string; source?: 'manual' | 'auto' },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('categories', {
      ...fields,
      normalizedName: fields.name.toLowerCase(),
    })
  })
}

async function insertLegacyCategory(
  t: ReturnType<typeof convexTest>,
  fields: { name: string; userId?: Id<'users'>; icon?: string },
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('categories', fields)
  })
}

describe('upsertCategory — case-insensitive dedup', () => {
  it('returns existing user category when name differs only by case', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)

    const existingId = await insertCategory(t, { name: 'Food', userId })

    const returnedId = await t.run(async (ctx) => {
      return await upsertCategory(ctx, userId, 'food')
    })

    expect(returnedId).toBe(existingId)
  })

  it('returns existing predefined category when name differs only by case', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)

    const predefinedId = await insertCategory(t, { name: 'Coworking' })

    const returnedId = await t.run(async (ctx) => {
      return await upsertCategory(ctx, userId, 'coworking')
    })

    expect(returnedId).toBe(predefinedId)
  })

  it('creates a new category when no case-insensitive match exists', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)

    await insertCategory(t, { name: 'Food', userId })

    const newId = await t.run(async (ctx) => {
      return await upsertCategory(ctx, userId, 'Transport')
    })

    const created = await t.run(async (ctx) => {
      return await ctx.db.get('categories', newId)
    })
    expect(created).not.toBeNull()
    expect(created!.name).toBe('Transport')
    expect(created!.normalizedName).toBe('transport')
  })

  it('marks auto-created categories with source "auto"', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)

    const newId = await t.run(async (ctx) => {
      return await upsertCategory(ctx, userId, 'AutoCategory')
    })

    const created = await t.run(async (ctx) => {
      return await ctx.db.get('categories', newId)
    })
    expect(created!.source).toBe('auto')
  })
})

describe('categories.create — case-insensitive dedup', () => {
  it('throws when creating a category with same name but different case', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    await insertCategory(t, { name: 'Food', userId })

    await expect(asUser.mutation(api.categories.create, { name: 'food' })).rejects.toThrow(
      'Category already exists',
    )
  })

  it('throws when creating a category matching a predefined category (case-insensitive)', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)

    await insertCategory(t, { name: 'Coworking' })

    await expect(asUser.mutation(api.categories.create, { name: 'COWORKING' })).rejects.toThrow(
      'Category already exists',
    )
  })

  it('stores normalizedName on newly created categories', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)

    const categoryId = await asUser.mutation(api.categories.create, {
      name: 'My Category',
    })

    const category = await t.run(async (ctx) => {
      return await ctx.db.get('categories', categoryId)
    })
    expect(category!.normalizedName).toBe('my category')
  })

  it('marks explicitly created categories with source "manual"', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)

    const categoryId = await asUser.mutation(api.categories.create, {
      name: 'Settings Category',
    })

    const category = await t.run(async (ctx) => {
      return await ctx.db.get('categories', categoryId)
    })
    expect(category!.source).toBe('manual')
  })
})

describe('legacy rows without normalizedName', () => {
  it('upsertCategory finds legacy user category by exact name and backfills normalizedName', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)

    const legacyId = await insertLegacyCategory(t, { name: 'Food', userId })

    const returnedId = await t.run(async (ctx) => {
      return await upsertCategory(ctx, userId, 'Food')
    })

    expect(returnedId).toBe(legacyId)

    const patched = await t.run(async (ctx) => {
      return await ctx.db.get('categories', legacyId)
    })
    expect(patched!.normalizedName).toBe('food')
  })

  it('upsertCategory finds legacy predefined category by exact name and backfills normalizedName', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)

    const legacyId = await insertLegacyCategory(t, { name: 'Coworking' })

    const returnedId = await t.run(async (ctx) => {
      return await upsertCategory(ctx, userId, 'Coworking')
    })

    expect(returnedId).toBe(legacyId)

    const patched = await t.run(async (ctx) => {
      return await ctx.db.get('categories', legacyId)
    })
    expect(patched!.normalizedName).toBe('coworking')
  })

  it('categories.create rejects exact-name duplicate against legacy row', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    await insertLegacyCategory(t, { name: 'Food', userId })

    await expect(asUser.mutation(api.categories.create, { name: 'Food' })).rejects.toThrow(
      'Category already exists',
    )
  })
})

// ── Helper for tests that need expenses ─────────────────────────────────

async function insertExpense(
  t: ReturnType<typeof convexTest>,
  userId: Id<'users'>,
  categoryId: Id<'categories'>,
  overrides: Partial<{ merchant: string; date: string }> = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('expenses', {
      userId,
      date: overrides.date ?? '2026-03-01',
      merchant: overrides.merchant ?? 'Test Merchant',
      amount: 2500,
      categoryId,
      createdAt: Date.now(),
    })
  })
}

describe('categories.rename', () => {
  it('renames a user-custom category', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, { name: 'Food', userId })

    await asUser.mutation(api.categories.rename, { id: catId, newName: 'Groceries' })

    const updated = await t.run(async (ctx) => ctx.db.get('categories', catId))
    expect(updated?.name).toBe('Groceries')
    expect(updated?.normalizedName).toBe('groceries')
  })

  it('rejects renaming a predefined category', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)
    const predefinedId = await insertCategory(t, { name: 'Coworking' })

    await expect(
      asUser.mutation(api.categories.rename, { id: predefinedId, newName: 'New Name' }),
    ).rejects.toThrow('Cannot modify this category')
  })

  it('rejects duplicate name (case-insensitive)', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, { name: 'Food', userId })
    await insertCategory(t, { name: 'Transport', userId })

    await expect(
      asUser.mutation(api.categories.rename, { id: catId, newName: 'transport' }),
    ).rejects.toThrow('Category already exists')
  })

  it('promotes auto-created category to manual on rename', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, { name: 'AutoCat', userId, source: 'auto' })

    await asUser.mutation(api.categories.rename, { id: catId, newName: 'My Category' })

    const updated = await t.run(async (ctx) => ctx.db.get('categories', catId))
    expect(updated?.source).toBe('manual')
  })

  it('renamed auto-created category survives orphan cleanup', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, { name: 'AutoCat', userId, source: 'auto' })

    await asUser.mutation(api.categories.rename, { id: catId, newName: 'Kept Category' })

    await t.mutation(internal.categories.cleanupOrphanedCategories, {})

    const cat = await t.run(async (ctx) => ctx.db.get('categories', catId))
    expect(cat).not.toBeNull()
    expect(cat?.name).toBe('Kept Category')
  })
})

describe('categories.remove', () => {
  it('deletes orphaned user-custom category', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, { name: 'Unused', userId })

    await asUser.mutation(api.categories.remove, { id: catId })

    const cat = await t.run(async (ctx) => ctx.db.get('categories', catId))
    expect(cat).toBeNull()
  })

  it('rejects deletion of predefined category', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)
    const predefinedId = await insertCategory(t, { name: 'Coworking' })

    await expect(asUser.mutation(api.categories.remove, { id: predefinedId })).rejects.toThrow(
      'Cannot delete this category',
    )
  })

  it('rejects deletion when expenses reference the category', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, { name: 'InUse', userId })
    await insertExpense(t, userId, catId)

    await expect(asUser.mutation(api.categories.remove, { id: catId })).rejects.toThrow(
      'Cannot delete category that is used by expenses',
    )
  })
})

describe('categories.listWithCounts', () => {
  it('returns categories with correct expense counts', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catA = await insertCategory(t, { name: 'Food', userId })
    await insertCategory(t, { name: 'Transport', userId })

    await insertExpense(t, userId, catA)
    await insertExpense(t, userId, catA, { date: '2026-03-02' })

    const result = await asUser.query(api.categories.listWithCounts, {})
    const food = result.find((c) => c.name === 'Food')
    const transport = result.find((c) => c.name === 'Transport')

    expect(food?.expenseCount).toBe(2)
    expect(transport?.expenseCount).toBe(0)
  })

  it('includes predefined categories with isPredefined flag', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    await insertCategory(t, { name: 'Predefined' })
    await insertCategory(t, { name: 'Custom', userId })

    const result = await asUser.query(api.categories.listWithCounts, {})
    const predefined = result.find((c) => c.name === 'Predefined')
    const custom = result.find((c) => c.name === 'Custom')

    expect(predefined?.isPredefined).toBe(true)
    expect(custom?.isPredefined).toBe(false)
  })
})

describe('cleanupOrphanedCategories', () => {
  it('deletes orphaned auto-created categories', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const orphanedId = await insertCategory(t, { name: 'Orphaned', userId, source: 'auto' })

    await t.mutation(internal.categories.cleanupOrphanedCategories, {})

    const cat = await t.run(async (ctx) => ctx.db.get('categories', orphanedId))
    expect(cat).toBeNull()
  })

  it('preserves orphaned manually-created categories', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const manualId = await insertCategory(t, { name: 'ManualEmpty', userId, source: 'manual' })

    await t.mutation(internal.categories.cleanupOrphanedCategories, {})

    const cat = await t.run(async (ctx) => ctx.db.get('categories', manualId))
    expect(cat).not.toBeNull()
  })

  it('preserves orphaned legacy categories (no source field)', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const legacyId = await insertCategory(t, { name: 'Legacy', userId })

    await t.mutation(internal.categories.cleanupOrphanedCategories, {})

    const cat = await t.run(async (ctx) => ctx.db.get('categories', legacyId))
    expect(cat).not.toBeNull()
  })

  it('preserves predefined categories even if unreferenced', async () => {
    const t = convexTest(schema, modules)
    const predefinedId = await insertCategory(t, { name: 'Predefined' })

    await t.mutation(internal.categories.cleanupOrphanedCategories, {})

    const cat = await t.run(async (ctx) => ctx.db.get('categories', predefinedId))
    expect(cat).not.toBeNull()
  })

  it('preserves referenced auto-created categories', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, { name: 'InUse', userId, source: 'auto' })
    await insertExpense(t, userId, catId)

    await t.mutation(internal.categories.cleanupOrphanedCategories, {})

    const cat = await t.run(async (ctx) => ctx.db.get('categories', catId))
    expect(cat).not.toBeNull()
  })
})

describe('expense deletion cleans up orphaned categories', () => {
  it('deletes orphaned auto-created category when last expense is removed', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, { name: 'Orphanable', userId, source: 'auto' })
    const expenseId = await insertExpense(t, userId, catId)

    await asUser.mutation(api.expenses.remove, { id: expenseId })

    const cat = await t.run(async (ctx) => ctx.db.get('categories', catId))
    expect(cat).toBeNull()
  })

  it('preserves manually-created category even after last expense is removed', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, { name: 'ManualCat', userId, source: 'manual' })
    const expenseId = await insertExpense(t, userId, catId)

    await asUser.mutation(api.expenses.remove, { id: expenseId })

    const cat = await t.run(async (ctx) => ctx.db.get('categories', catId))
    expect(cat).not.toBeNull()
  })

  it('preserves predefined category even after last expense is removed', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const predefinedId = await insertCategory(t, { name: 'Predefined' })
    const expenseId = await insertExpense(t, userId, predefinedId)

    await asUser.mutation(api.expenses.remove, { id: expenseId })

    const cat = await t.run(async (ctx) => ctx.db.get('categories', predefinedId))
    expect(cat).not.toBeNull()
  })
})
