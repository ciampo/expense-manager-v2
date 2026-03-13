// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

async function setupAuthenticatedUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert('users', {})
  })
  const asUser = t.withIdentity({ subject: `${userId}|fake-session` })
  return { userId, asUser }
}

async function insertCategory(t: ReturnType<typeof convexTest>, userId: Id<'users'>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('categories', {
      name: 'Test Category',
      normalizedName: 'test category',
      userId,
    })
  })
}

async function insertMerchant(t: ReturnType<typeof convexTest>, userId: Id<'users'>, name: string) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('merchants', {
      name,
      normalizedName: name.toLowerCase(),
      userId,
    })
  })
}

async function insertExpense(
  t: ReturnType<typeof convexTest>,
  userId: Id<'users'>,
  categoryId: Id<'categories'>,
  overrides: Partial<{ merchant: string; date: string; amount: number }> = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('expenses', {
      userId,
      date: overrides.date ?? '2026-03-01',
      merchant: overrides.merchant ?? 'Test Merchant',
      amount: overrides.amount ?? 2500,
      categoryId,
      createdAt: Date.now(),
    })
  })
}

describe('merchants.listWithCounts', () => {
  it('returns empty array for unauthenticated user', async () => {
    const t = convexTest(schema, modules)
    const result = await t.query(api.merchants.listWithCounts, {})
    expect(result).toEqual([])
  })

  it('returns merchants with expense counts', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, userId)

    await insertMerchant(t, userId, 'Starbucks')
    await insertMerchant(t, userId, 'Amazon')
    await insertExpense(t, userId, catId, { merchant: 'Starbucks' })
    await insertExpense(t, userId, catId, { merchant: 'Starbucks' })

    const result = await asUser.query(api.merchants.listWithCounts, {})
    expect(result).toHaveLength(2)

    const starbucks = result.find((m) => m.name === 'Starbucks')
    const amazon = result.find((m) => m.name === 'Amazon')
    expect(starbucks?.expenseCount).toBe(2)
    expect(amazon?.expenseCount).toBe(0)
  })

  it('counts case-insensitively', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, userId)

    await insertMerchant(t, userId, 'Starbucks')
    await insertExpense(t, userId, catId, { merchant: 'starbucks' })

    const result = await asUser.query(api.merchants.listWithCounts, {})
    expect(result[0].expenseCount).toBe(1)
  })
})

describe('merchants.rename', () => {
  it('renames merchant and updates linked expenses', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, userId)

    const merchantId = await insertMerchant(t, userId, 'Old Name')
    const expenseId = await insertExpense(t, userId, catId, { merchant: 'Old Name' })

    await asUser.mutation(api.merchants.rename, {
      id: merchantId,
      newName: 'New Name',
    })

    const merchant = await t.run(async (ctx) => ctx.db.get('merchants', merchantId))
    expect(merchant?.name).toBe('New Name')
    expect(merchant?.normalizedName).toBe('new name')

    const expense = await t.run(async (ctx) => ctx.db.get('expenses', expenseId))
    expect(expense?.merchant).toBe('New Name')
  })

  it('rejects duplicate name (case-insensitive)', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    const merchantId = await insertMerchant(t, userId, 'Starbucks')
    await insertMerchant(t, userId, 'Amazon')

    await expect(
      asUser.mutation(api.merchants.rename, { id: merchantId, newName: 'amazon' }),
    ).rejects.toThrow('A merchant with this name already exists')
  })

  it('rejects empty name', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    const merchantId = await insertMerchant(t, userId, 'Starbucks')

    await expect(
      asUser.mutation(api.merchants.rename, { id: merchantId, newName: '   ' }),
    ).rejects.toThrow()
  })

  it("rejects rename of another user's merchant", async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id } = await setupAuthenticatedUser(t)
    const { asUser: asUser2 } = await setupAuthenticatedUser(t)

    const merchantId = await insertMerchant(t, user1Id, 'Starbucks')

    await expect(
      asUser2.mutation(api.merchants.rename, { id: merchantId, newName: 'New' }),
    ).rejects.toThrow('Merchant not found')
  })
})

describe('merchants.remove', () => {
  it('deletes orphaned merchant', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    const merchantId = await insertMerchant(t, userId, 'Orphaned')

    await asUser.mutation(api.merchants.remove, { id: merchantId })

    const merchant = await t.run(async (ctx) => ctx.db.get('merchants', merchantId))
    expect(merchant).toBeNull()
  })

  it('rejects deletion when expenses reference the merchant', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, userId)

    const merchantId = await insertMerchant(t, userId, 'InUse')
    await insertExpense(t, userId, catId, { merchant: 'InUse' })

    await expect(asUser.mutation(api.merchants.remove, { id: merchantId })).rejects.toThrow(
      'Cannot delete merchant that is used by expenses',
    )
  })

  it("rejects deletion of another user's merchant", async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id } = await setupAuthenticatedUser(t)
    const { asUser: asUser2 } = await setupAuthenticatedUser(t)

    const merchantId = await insertMerchant(t, user1Id, 'Starbucks')

    await expect(asUser2.mutation(api.merchants.remove, { id: merchantId })).rejects.toThrow(
      'Merchant not found',
    )
  })
})

describe('cleanupOrphanedMerchants', () => {
  it('deletes orphaned merchants', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)

    const orphanedId = await insertMerchant(t, userId, 'Orphaned')

    await t.mutation(internal.merchants.cleanupOrphanedMerchants, {})

    const merchant = await t.run(async (ctx) => ctx.db.get('merchants', orphanedId))
    expect(merchant).toBeNull()
  })

  it('preserves referenced merchants', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, userId)

    const merchantId = await insertMerchant(t, userId, 'InUse')
    await insertExpense(t, userId, catId, { merchant: 'InUse' })

    await t.mutation(internal.merchants.cleanupOrphanedMerchants, {})

    const merchant = await t.run(async (ctx) => ctx.db.get('merchants', merchantId))
    expect(merchant).not.toBeNull()
  })
})

describe('expense deletion cleans up orphaned merchants', () => {
  it('deletes orphaned merchant when last expense is removed', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, userId)

    await insertMerchant(t, userId, 'Test Merchant')
    const expenseId = await insertExpense(t, userId, catId, { merchant: 'Test Merchant' })

    await asUser.mutation(api.expenses.remove, { id: expenseId })

    const merchants = await t.run(async (ctx) => ctx.db.query('merchants').collect())
    expect(merchants).toHaveLength(0)
  })

  it('preserves merchant when other expenses still reference it', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catId = await insertCategory(t, userId)

    await insertMerchant(t, userId, 'Test Merchant')
    const expense1 = await insertExpense(t, userId, catId, { merchant: 'Test Merchant' })
    await insertExpense(t, userId, catId, { merchant: 'Test Merchant', date: '2026-03-02' })

    await asUser.mutation(api.expenses.remove, { id: expense1 })

    const merchants = await t.run(async (ctx) => ctx.db.query('merchants').collect())
    expect(merchants).toHaveLength(1)
  })
})
