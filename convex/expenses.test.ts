// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

/**
 * Create an authenticated test context. Inserts a user into the database
 * and returns a `withIdentity` accessor whose `auth.getUserId` resolves
 * to that user.
 *
 * `@convex-dev/auth` reads the user ID from the first segment of
 * `identity.subject` (split by "|").
 */
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

async function setupStorageFile(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    return await ctx.storage.store(new Blob(['test']))
  })
}

async function setupUploadRecord(
  t: ReturnType<typeof convexTest>,
  storageId: Id<'_storage'>,
  userId: Id<'users'>,
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('uploads', {
      storageId,
      userId,
      createdAt: Date.now(),
    })
  })
}

async function insertExpense(
  t: ReturnType<typeof convexTest>,
  userId: Id<'users'>,
  categoryId: Id<'categories'>,
  overrides: Partial<{ date: string; merchant: string; amount: number }> = {},
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

const VALID_EXPENSE_FIELDS = {
  date: '2026-03-01',
  merchant: 'Test Merchant',
  amount: 2500,
} as const

describe('expenses.list', () => {
  it('returns paginated envelope for unauthenticated users', async () => {
    const t = convexTest(schema, modules)
    const result = await t.query(api.expenses.list, {})
    expect(result).toEqual({ expenses: [], continueCursor: null, isDone: true })
  })

  it('returns expenses in descending date order', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, { date: '2026-01-15' })
    await insertExpense(t, userId, categoryId, { date: '2026-03-01' })
    await insertExpense(t, userId, categoryId, { date: '2026-02-10' })

    const result = await asUser.query(api.expenses.list, {})
    expect(result.expenses).toHaveLength(3)
    expect(result.expenses.map((e) => e.date)).toEqual(['2026-03-01', '2026-02-10', '2026-01-15'])
    expect(result.isDone).toBe(true)
  })

  it('respects the limit parameter', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    for (let i = 1; i <= 5; i++) {
      await insertExpense(t, userId, categoryId, {
        date: `2026-03-${String(i).padStart(2, '0')}`,
      })
    }

    const result = await asUser.query(api.expenses.list, { limit: 2 })
    expect(result.expenses).toHaveLength(2)
    expect(result.isDone).toBe(false)
    expect(result.continueCursor).toBeTruthy()
  })

  it('paginates through all results using cursor', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    for (let i = 1; i <= 5; i++) {
      await insertExpense(t, userId, categoryId, {
        date: `2026-03-${String(i).padStart(2, '0')}`,
      })
    }

    const page1 = await asUser.query(api.expenses.list, { limit: 3 })
    expect(page1.expenses).toHaveLength(3)
    expect(page1.isDone).toBe(false)

    const page2 = await asUser.query(api.expenses.list, {
      limit: 3,
      cursor: page1.continueCursor,
    })
    expect(page2.expenses).toHaveLength(2)
    expect(page2.isDone).toBe(true)

    const allDates = [...page1.expenses, ...page2.expenses].map((e) => e.date)
    expect(allDates).toEqual(['2026-03-05', '2026-03-04', '2026-03-03', '2026-03-02', '2026-03-01'])
  })

  it('caps limit at 100 even if a larger value is requested', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId)

    const result = await asUser.query(api.expenses.list, { limit: 500 })
    expect(result.expenses).toHaveLength(1)
    expect(result.isDone).toBe(true)
  })

  it('clamps non-positive and fractional limit to at least 1', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, { date: '2026-01-01' })
    await insertExpense(t, userId, categoryId, { date: '2026-01-02' })

    const zeroResult = await asUser.query(api.expenses.list, { limit: 0 })
    expect(zeroResult.expenses).toHaveLength(1)

    const negativeResult = await asUser.query(api.expenses.list, { limit: -5 })
    expect(negativeResult.expenses).toHaveLength(1)

    const fractionalResult = await asUser.query(api.expenses.list, { limit: 1.7 })
    expect(fractionalResult.expenses).toHaveLength(1)
  })

  it('returns empty expenses for a user with no data', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)

    const result = await asUser.query(api.expenses.list, {})
    expect(result.expenses).toEqual([])
    expect(result.isDone).toBe(true)
  })

  it('does not return expenses from other users', async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id, asUser: asUser1 } = await setupAuthenticatedUser(t)
    const { userId: user2Id } = await setupAuthenticatedUser(t)
    const cat1 = await setupCategory(t, user1Id)
    const cat2 = await setupCategory(t, user2Id)

    await insertExpense(t, user1Id, cat1, { merchant: 'User1 Merchant' })
    await insertExpense(t, user2Id, cat2, { merchant: 'User2 Merchant' })

    const result = await asUser1.query(api.expenses.list, {})
    expect(result.expenses).toHaveLength(1)
    expect(result.expenses[0].merchant).toBe('User1 Merchant')
  })
})

describe('expenses.update — attachment handling', () => {
  it('preserves existing attachment when attachmentId is omitted', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)
    const storageId = await setupStorageFile(t)
    await setupUploadRecord(t, storageId, userId)

    const expenseId = await t.run(async (ctx) => {
      return await ctx.db.insert('expenses', {
        userId,
        ...VALID_EXPENSE_FIELDS,
        categoryId,
        attachmentId: storageId,
        createdAt: Date.now(),
      })
    })

    await asUser.mutation(api.expenses.update, {
      id: expenseId,
      ...VALID_EXPENSE_FIELDS,
      categoryId,
      merchant: 'Updated Merchant',
    })

    const updated = await t.run(async (ctx) => {
      return await ctx.db.get('expenses', expenseId)
    })
    expect(updated?.attachmentId).toBe(storageId)

    const fileStillExists = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(storageId)
    })
    expect(fileStillExists).not.toBeNull()
  })

  it('replaces attachment when a new attachmentId is provided', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    const oldStorageId = await setupStorageFile(t)
    await setupUploadRecord(t, oldStorageId, userId)
    const newStorageId = await setupStorageFile(t)
    await setupUploadRecord(t, newStorageId, userId)

    const expenseId = await t.run(async (ctx) => {
      return await ctx.db.insert('expenses', {
        userId,
        ...VALID_EXPENSE_FIELDS,
        categoryId,
        attachmentId: oldStorageId,
        createdAt: Date.now(),
      })
    })

    await asUser.mutation(api.expenses.update, {
      id: expenseId,
      ...VALID_EXPENSE_FIELDS,
      categoryId,
      attachmentId: newStorageId,
    })

    const updated = await t.run(async (ctx) => {
      return await ctx.db.get('expenses', expenseId)
    })
    expect(updated?.attachmentId).toBe(newStorageId)

    const oldFileStillExists = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(oldStorageId)
    })
    expect(oldFileStillExists).toBeNull()
  })

  it('keeps attachment when the same attachmentId is re-sent', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    const storageId = await setupStorageFile(t)
    await setupUploadRecord(t, storageId, userId)

    const expenseId = await t.run(async (ctx) => {
      return await ctx.db.insert('expenses', {
        userId,
        ...VALID_EXPENSE_FIELDS,
        categoryId,
        attachmentId: storageId,
        createdAt: Date.now(),
      })
    })

    await asUser.mutation(api.expenses.update, {
      id: expenseId,
      ...VALID_EXPENSE_FIELDS,
      categoryId,
      attachmentId: storageId,
    })

    const updated = await t.run(async (ctx) => {
      return await ctx.db.get('expenses', expenseId)
    })
    expect(updated?.attachmentId).toBe(storageId)

    const fileStillExists = await t.run(async (ctx) => {
      return await ctx.storage.getUrl(storageId)
    })
    expect(fileStillExists).not.toBeNull()
  })
})

describe('expenses.update — category orphan cleanup', () => {
  it('deletes orphaned user-custom category when expense changes category', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    const catA = await setupCategory(t, userId)
    const catB = await t.run(async (ctx) => {
      return await ctx.db.insert('categories', {
        name: 'Category B',
        normalizedName: 'category b',
        userId,
      })
    })

    const expenseId = await insertExpense(t, userId, catA)

    await asUser.mutation(api.expenses.update, {
      id: expenseId,
      ...VALID_EXPENSE_FIELDS,
      categoryId: catB,
    })

    const oldCategory = await t.run(async (ctx) => ctx.db.get('categories', catA))
    expect(oldCategory).toBeNull()
  })

  it('does not delete predefined category when expense changes category', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    const predefinedCatId = await t.run(async (ctx) => {
      return await ctx.db.insert('categories', {
        name: 'Predefined',
        normalizedName: 'predefined',
        icon: '📦',
      })
    })
    const userCatId = await setupCategory(t, userId)
    const expenseId = await insertExpense(t, userId, predefinedCatId)

    await asUser.mutation(api.expenses.update, {
      id: expenseId,
      ...VALID_EXPENSE_FIELDS,
      categoryId: userCatId,
    })

    const predefinedCat = await t.run(async (ctx) => ctx.db.get('categories', predefinedCatId))
    expect(predefinedCat).not.toBeNull()
  })

  it('does not delete user-custom category still referenced by other expenses', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    const catA = await setupCategory(t, userId)
    const catB = await t.run(async (ctx) => {
      return await ctx.db.insert('categories', {
        name: 'Category B',
        normalizedName: 'category b',
        userId,
      })
    })

    await insertExpense(t, userId, catA, { date: '2026-01-01' })
    const expenseId = await insertExpense(t, userId, catA, { date: '2026-01-02' })

    await asUser.mutation(api.expenses.update, {
      id: expenseId,
      ...VALID_EXPENSE_FIELDS,
      categoryId: catB,
    })

    const oldCategory = await t.run(async (ctx) => ctx.db.get('categories', catA))
    expect(oldCategory).not.toBeNull()
  })
})
