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
