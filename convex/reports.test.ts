// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
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

async function setupCategory(t: ReturnType<typeof convexTest>, userId: Id<'users'>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('categories', {
      name: 'Test Category',
      normalizedName: 'test category',
      userId,
    })
  })
}

async function insertExpense(
  t: ReturnType<typeof convexTest>,
  userId: Id<'users'>,
  categoryId: Id<'categories'>,
  date: string,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('expenses', {
      userId,
      date,
      merchant: 'Test',
      amount: 1000,
      categoryId,
      createdAt: Date.now(),
    })
  })
}

describe('reports.availableMonths', () => {
  it('returns empty array for unauthenticated users', async () => {
    const t = convexTest(schema, modules)
    const result = await t.query(api.reports.availableMonths, {})
    expect(result).toEqual([])
  })

  it('returns empty array for users with no expenses', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)

    const result = await asUser.query(api.reports.availableMonths, {})
    expect(result).toEqual([])
  })

  it('returns a single month when all expenses are in one month', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, '2026-03-01')
    await insertExpense(t, userId, categoryId, '2026-03-15')
    await insertExpense(t, userId, categoryId, '2026-03-28')

    const result = await asUser.query(api.reports.availableMonths, {})
    expect(result).toEqual([{ year: 2026, month: 3 }])
  })

  it('returns distinct months sorted newest first', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, '2025-06-10')
    await insertExpense(t, userId, categoryId, '2026-01-05')
    await insertExpense(t, userId, categoryId, '2025-11-20')

    const result = await asUser.query(api.reports.availableMonths, {})
    expect(result).toEqual([
      { year: 2026, month: 1 },
      { year: 2025, month: 11 },
      { year: 2025, month: 6 },
    ])
  })

  it('deduplicates multiple expenses within the same month', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, '2026-02-01')
    await insertExpense(t, userId, categoryId, '2026-02-14')
    await insertExpense(t, userId, categoryId, '2026-02-28')
    await insertExpense(t, userId, categoryId, '2026-03-10')

    const result = await asUser.query(api.reports.availableMonths, {})
    expect(result).toEqual([
      { year: 2026, month: 3 },
      { year: 2026, month: 2 },
    ])
  })

  it('handles expenses spanning multiple years', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, '2024-12-25')
    await insertExpense(t, userId, categoryId, '2025-06-15')
    await insertExpense(t, userId, categoryId, '2026-01-01')

    const result = await asUser.query(api.reports.availableMonths, {})
    expect(result).toEqual([
      { year: 2026, month: 1 },
      { year: 2025, month: 6 },
      { year: 2024, month: 12 },
    ])
  })

  it('does not include months from other users', async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id, asUser: asUser1 } = await setupAuthenticatedUser(t)
    const { userId: user2Id } = await setupAuthenticatedUser(t)
    const cat1 = await setupCategory(t, user1Id)
    const cat2 = await setupCategory(t, user2Id)

    await insertExpense(t, user1Id, cat1, '2026-03-01')
    await insertExpense(t, user2Id, cat2, '2026-05-01')

    const result = await asUser1.query(api.reports.availableMonths, {})
    expect(result).toEqual([{ year: 2026, month: 3 }])
  })
})

// ── monthlyData ─────────────────────────────────────────────────────────

describe('reports.monthlyData', () => {
  it('returns empty result for unauthenticated users', async () => {
    const t = convexTest(schema, modules)
    const result = await t.query(api.reports.monthlyData, { year: 2026, month: 3 })
    expect(result).toEqual({ expenses: [], categories: {}, total: 0 })
  })

  it('returns empty result when user has no expenses in the requested month', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, '2026-01-15')

    const result = await asUser.query(api.reports.monthlyData, { year: 2026, month: 3 })
    expect(result).toEqual({ expenses: [], categories: {}, total: 0 })
  })

  it('returns expenses only within the requested month', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, '2026-02-28')
    await insertExpense(t, userId, categoryId, '2026-03-01')
    await insertExpense(t, userId, categoryId, '2026-03-15')
    await insertExpense(t, userId, categoryId, '2026-04-01')

    const result = await asUser.query(api.reports.monthlyData, { year: 2026, month: 3 })
    expect(result.expenses).toHaveLength(2)
    expect(result.expenses.map((e) => e.date)).toEqual(['2026-03-01', '2026-03-15'])
  })

  it('calculates total across all expenses in the month', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, '2026-03-01') // 1000
    await insertExpense(t, userId, categoryId, '2026-03-15') // 1000

    const result = await asUser.query(api.reports.monthlyData, { year: 2026, month: 3 })
    expect(result.total).toBe(2000)
  })

  it('aggregates expenses by category name', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const catFood = await setupCategory(t, userId)
    const catTransport = await t.run(async (ctx) => {
      return await ctx.db.insert('categories', {
        name: 'Transport',
        normalizedName: 'transport',
        userId,
      })
    })

    await insertExpense(t, userId, catFood, '2026-03-01')
    await insertExpense(t, userId, catFood, '2026-03-10')
    await insertExpense(t, userId, catTransport, '2026-03-15')

    const result = await asUser.query(api.reports.monthlyData, { year: 2026, month: 3 })
    expect(result.categories['Test Category']).toEqual({
      name: 'Test Category',
      total: 2000,
      count: 2,
    })
    expect(result.categories['Transport']).toEqual({
      name: 'Transport',
      total: 1000,
      count: 1,
    })
  })

  it('enriches expenses with category names', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, '2026-03-01')

    const result = await asUser.query(api.reports.monthlyData, { year: 2026, month: 3 })
    expect(result.expenses[0].categoryName).toBe('Test Category')
  })

  it('labels expenses with missing categories as "Unknown"', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, '2026-03-01')

    // Delete the category to simulate a dangling reference
    await t.run(async (ctx) => {
      await ctx.db.delete('categories', categoryId)
    })

    const result = await asUser.query(api.reports.monthlyData, { year: 2026, month: 3 })
    expect(result.expenses[0].categoryName).toBe('Unknown')
    expect(result.categories['Unknown']).toEqual({
      name: 'Unknown',
      total: 1000,
      count: 1,
    })
  })

  it('filters out categories belonging to other users', async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id, asUser: asUser1 } = await setupAuthenticatedUser(t)
    const { userId: user2Id } = await setupAuthenticatedUser(t)

    // Create a category owned by user2
    const otherUserCat = await t.run(async (ctx) => {
      return await ctx.db.insert('categories', {
        name: 'Other User Cat',
        normalizedName: 'other user cat',
        userId: user2Id,
      })
    })

    // Force-insert an expense for user1 referencing user2's category
    await t.run(async (ctx) => {
      await ctx.db.insert('expenses', {
        userId: user1Id,
        date: '2026-03-05',
        merchant: 'Test',
        amount: 500,
        categoryId: otherUserCat,
        createdAt: Date.now(),
      })
    })

    const result = await asUser1.query(api.reports.monthlyData, { year: 2026, month: 3 })
    expect(result.expenses[0].categoryName).toBe('Unknown')
  })

  it('allows predefined categories (no userId) for all users', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    const predefinedCat = await t.run(async (ctx) => {
      return await ctx.db.insert('categories', {
        name: 'Food & Dining',
        normalizedName: 'food & dining',
        icon: '🍕',
      })
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('expenses', {
        userId,
        date: '2026-03-05',
        merchant: 'Restaurant',
        amount: 2500,
        categoryId: predefinedCat,
        createdAt: Date.now(),
      })
    })

    const result = await asUser.query(api.reports.monthlyData, { year: 2026, month: 3 })
    expect(result.expenses[0].categoryName).toBe('Food & Dining')
  })

  it('does not include expenses from other users', async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id, asUser: asUser1 } = await setupAuthenticatedUser(t)
    const { userId: user2Id } = await setupAuthenticatedUser(t)
    const cat1 = await setupCategory(t, user1Id)
    const cat2 = await setupCategory(t, user2Id)

    await insertExpense(t, user1Id, cat1, '2026-03-01')
    await insertExpense(t, user2Id, cat2, '2026-03-15')

    const result = await asUser1.query(api.reports.monthlyData, { year: 2026, month: 3 })
    expect(result.expenses).toHaveLength(1)
    expect(result.total).toBe(1000)
  })

  it('throws on month above range', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)

    await expect(asUser.query(api.reports.monthlyData, { year: 2026, month: 13 })).rejects.toThrow(
      'Invalid month',
    )
  })

  it('throws on month below range', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)

    await expect(asUser.query(api.reports.monthlyData, { year: 2026, month: 0 })).rejects.toThrow(
      'Invalid month',
    )
  })

  it('sorts expenses by date ascending', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, '2026-03-20')
    await insertExpense(t, userId, categoryId, '2026-03-05')
    await insertExpense(t, userId, categoryId, '2026-03-12')

    const result = await asUser.query(api.reports.monthlyData, { year: 2026, month: 3 })
    expect(result.expenses.map((e) => e.date)).toEqual(['2026-03-05', '2026-03-12', '2026-03-20'])
  })
})

// ── monthlyAttachments ──────────────────────────────────────────────────

describe('reports.monthlyAttachments', () => {
  it('returns empty array for unauthenticated users', async () => {
    const t = convexTest(schema, modules)
    const result = await t.query(api.reports.monthlyAttachments, { year: 2026, month: 3 })
    expect(result).toEqual([])
  })

  it('returns empty array when no expenses have attachments', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, '2026-03-01')

    const result = await asUser.query(api.reports.monthlyAttachments, { year: 2026, month: 3 })
    expect(result).toEqual([])
  })

  it('returns attachment metadata for expenses with attachments', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(['receipt'])))

    await t.run(async (ctx) => {
      await ctx.db.insert('expenses', {
        userId,
        date: '2026-03-10',
        merchant: 'Grocery Store',
        amount: 4500,
        categoryId,
        attachmentId: storageId,
        createdAt: Date.now(),
      })
    })

    const result = await asUser.query(api.reports.monthlyAttachments, { year: 2026, month: 3 })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      date: '2026-03-10',
      merchant: 'Grocery Store',
      storageId,
    })
    expect(result[0].url).not.toBeNull()
  })

  it('does not include expenses without attachments', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(['receipt'])))

    await insertExpense(t, userId, categoryId, '2026-03-01') // no attachment

    await t.run(async (ctx) => {
      await ctx.db.insert('expenses', {
        userId,
        date: '2026-03-15',
        merchant: 'Shop',
        amount: 2000,
        categoryId,
        attachmentId: storageId,
        createdAt: Date.now(),
      })
    })

    const result = await asUser.query(api.reports.monthlyAttachments, { year: 2026, month: 3 })
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-03-15')
  })

  it('does not include expenses from other users', async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id, asUser: asUser1 } = await setupAuthenticatedUser(t)
    const { userId: user2Id } = await setupAuthenticatedUser(t)
    const cat1 = await setupCategory(t, user1Id)
    const cat2 = await setupCategory(t, user2Id)

    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(['receipt'])))

    await t.run(async (ctx) => {
      await ctx.db.insert('expenses', {
        userId: user2Id,
        date: '2026-03-10',
        merchant: 'Other User Shop',
        amount: 1000,
        categoryId: cat2,
        attachmentId: storageId,
        createdAt: Date.now(),
      })
    })

    await insertExpense(t, user1Id, cat1, '2026-03-10') // no attachment

    const result = await asUser1.query(api.reports.monthlyAttachments, { year: 2026, month: 3 })
    expect(result).toEqual([])
  })

  it('only includes attachments from the requested month', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    const storageId1 = await t.run(async (ctx) => ctx.storage.store(new Blob(['feb'])))
    const storageId2 = await t.run(async (ctx) => ctx.storage.store(new Blob(['mar'])))

    await t.run(async (ctx) => {
      await ctx.db.insert('expenses', {
        userId,
        date: '2026-02-15',
        merchant: 'Feb Shop',
        amount: 1000,
        categoryId,
        attachmentId: storageId1,
        createdAt: Date.now(),
      })
      await ctx.db.insert('expenses', {
        userId,
        date: '2026-03-15',
        merchant: 'Mar Shop',
        amount: 2000,
        categoryId,
        attachmentId: storageId2,
        createdAt: Date.now(),
      })
    })

    const result = await asUser.query(api.reports.monthlyAttachments, { year: 2026, month: 3 })
    expect(result).toHaveLength(1)
    expect(result[0].merchant).toBe('Mar Shop')
  })

  it('throws on month below range', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)

    await expect(
      asUser.query(api.reports.monthlyAttachments, { year: 2026, month: 0 }),
    ).rejects.toThrow('Invalid month')
  })

  it('throws on month above range', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)

    await expect(
      asUser.query(api.reports.monthlyAttachments, { year: 2026, month: 13 }),
    ).rejects.toThrow('Invalid month')
  })
})
