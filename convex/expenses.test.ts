// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import {
  setupAuthenticatedUser,
  setupCategory,
  insertExpense,
  setupStorageFile,
  setupUploadRecord,
} from './test-helpers'

const modules = import.meta.glob('./**/*.ts')

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

// ── get ─────────────────────────────────────────────────────────────────

describe('expenses.get', () => {
  it('returns null for unauthenticated users', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)
    const expenseId = await insertExpense(t, userId, categoryId)

    const result = await t.query(api.expenses.get, { id: expenseId })
    expect(result).toBeNull()
  })

  it('returns the expense when owned by the current user', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)
    const expenseId = await insertExpense(t, userId, categoryId, { merchant: 'My Shop' })

    const result = await asUser.query(api.expenses.get, { id: expenseId })
    expect(result).not.toBeNull()
    expect(result?.merchant).toBe('My Shop')
  })

  it('returns null when the expense belongs to another user', async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id } = await setupAuthenticatedUser(t)
    const { asUser: asUser2 } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, user1Id)
    const expenseId = await insertExpense(t, user1Id, categoryId)

    const result = await asUser2.query(api.expenses.get, { id: expenseId })
    expect(result).toBeNull()
  })
})

// ── getMerchants ────────────────────────────────────────────────────────

describe('expenses.getMerchants', () => {
  it('returns empty array for unauthenticated users', async () => {
    const t = convexTest(schema, modules)
    const result = await t.query(api.expenses.getMerchants, {})
    expect(result).toEqual([])
  })

  it('returns merchant names for the current user', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    await t.run(async (ctx) => {
      await ctx.db.insert('merchants', {
        name: 'Coffee Shop',
        normalizedName: 'coffee shop',
        userId,
      })
      await ctx.db.insert('merchants', {
        name: 'Gas Station',
        normalizedName: 'gas station',
        userId,
      })
    })

    const result = await asUser.query(api.expenses.getMerchants, {})
    expect(result).toHaveLength(2)
    expect(result).toContain('Coffee Shop')
    expect(result).toContain('Gas Station')
  })

  it('does not return merchants from other users', async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id, asUser: asUser1 } = await setupAuthenticatedUser(t)
    const { userId: user2Id } = await setupAuthenticatedUser(t)

    await t.run(async (ctx) => {
      await ctx.db.insert('merchants', {
        name: 'User1 Shop',
        normalizedName: 'user1 shop',
        userId: user1Id,
      })
      await ctx.db.insert('merchants', {
        name: 'User2 Shop',
        normalizedName: 'user2 shop',
        userId: user2Id,
      })
    })

    const result = await asUser1.query(api.expenses.getMerchants, {})
    expect(result).toEqual(['User1 Shop'])
  })
})

// ── create ──────────────────────────────────────────────────────────────

describe('expenses.create', () => {
  it('rejects unauthenticated calls', async () => {
    const t = convexTest(schema, modules)
    await expect(
      t.mutation(api.expenses.create, { ...VALID_EXPENSE_FIELDS, newCategoryName: 'Test' }),
    ).rejects.toThrow('Not authenticated')
  })

  it('creates an expense with all required fields', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    const expenseId = await asUser.mutation(api.expenses.create, {
      ...VALID_EXPENSE_FIELDS,
      categoryId,
    })

    const expense = await t.run(async (ctx) => ctx.db.get('expenses', expenseId))
    expect(expense).not.toBeNull()
    expect(expense?.date).toBe('2026-03-01')
    expect(expense?.merchant).toBe('Test Merchant')
    expect(expense?.amount).toBe(2500)
    expect(expense?.categoryId).toBe(categoryId)
    expect(expense?.userId).toBe(userId)
  })

  it('creates an expense with a comment', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    const expenseId = await asUser.mutation(api.expenses.create, {
      ...VALID_EXPENSE_FIELDS,
      categoryId,
      comment: 'Business lunch',
    })

    const expense = await t.run(async (ctx) => ctx.db.get('expenses', expenseId))
    expect(expense?.comment).toBe('Business lunch')
  })

  it('creates an expense with an attachment', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)
    const storageId = await setupStorageFile(t)
    await setupUploadRecord(t, storageId, userId)

    const expenseId = await asUser.mutation(api.expenses.create, {
      ...VALID_EXPENSE_FIELDS,
      categoryId,
      attachmentId: storageId,
    })

    const expense = await t.run(async (ctx) => ctx.db.get('expenses', expenseId))
    expect(expense?.attachmentId).toBe(storageId)
  })

  it('rejects attachment not owned by the current user', async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id, asUser: asUser1 } = await setupAuthenticatedUser(t)
    const { userId: user2Id } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, user1Id)
    const storageId = await setupStorageFile(t)
    await setupUploadRecord(t, storageId, user2Id)

    await expect(
      asUser1.mutation(api.expenses.create, {
        ...VALID_EXPENSE_FIELDS,
        categoryId,
        attachmentId: storageId,
      }),
    ).rejects.toThrow('Attachment not found or not owned by current user')
  })

  it('upserts a merchant record on creation', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await asUser.mutation(api.expenses.create, {
      ...VALID_EXPENSE_FIELDS,
      categoryId,
      merchant: 'New Merchant',
    })

    const merchants = await t.run(async (ctx) =>
      ctx.db
        .query('merchants')
        .filter((q) => q.eq(q.field('userId'), userId))
        .collect(),
    )
    expect(merchants).toHaveLength(1)
    expect(merchants[0].name).toBe('New Merchant')
  })

  it('creates a new category when newCategoryName is provided', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    const expenseId = await asUser.mutation(api.expenses.create, {
      ...VALID_EXPENSE_FIELDS,
      newCategoryName: 'Custom Category',
    })

    const expense = await t.run(async (ctx) => ctx.db.get('expenses', expenseId))
    expect(expense).not.toBeNull()

    const category = await t.run(async (ctx) => ctx.db.get('categories', expense!.categoryId))
    expect(category?.name).toBe('Custom Category')
    expect(category?.userId).toBe(userId)
  })
})

// ── remove ──────────────────────────────────────────────────────────────

describe('expenses.remove', () => {
  it('rejects unauthenticated calls', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)
    const expenseId = await insertExpense(t, userId, categoryId)

    await expect(t.mutation(api.expenses.remove, { id: expenseId })).rejects.toThrow(
      'Not authenticated',
    )
  })

  it('rejects when the expense belongs to another user', async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id } = await setupAuthenticatedUser(t)
    const { asUser: asUser2 } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, user1Id)
    const expenseId = await insertExpense(t, user1Id, categoryId)

    await expect(asUser2.mutation(api.expenses.remove, { id: expenseId })).rejects.toThrow(
      'Expense not found',
    )
  })

  it('deletes the expense', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)
    const expenseId = await insertExpense(t, userId, categoryId)

    await asUser.mutation(api.expenses.remove, { id: expenseId })

    const expense = await t.run(async (ctx) => ctx.db.get('expenses', expenseId))
    expect(expense).toBeNull()
  })

  it('cleans up attachment on deletion', async () => {
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

    await asUser.mutation(api.expenses.remove, { id: expenseId })

    const uploadRecord = await t.run(async (ctx) =>
      ctx.db
        .query('uploads')
        .filter((q) => q.eq(q.field('storageId'), storageId))
        .first(),
    )
    expect(uploadRecord).toBeNull()
  })

  it('cleans up orphaned user-custom category on deletion', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)
    const expenseId = await insertExpense(t, userId, categoryId)

    await asUser.mutation(api.expenses.remove, { id: expenseId })

    const category = await t.run(async (ctx) => ctx.db.get('categories', categoryId))
    expect(category).toBeNull()
  })

  it('does not delete category still referenced by other expenses', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    await insertExpense(t, userId, categoryId, { date: '2026-01-01' })
    const expenseToDelete = await insertExpense(t, userId, categoryId, { date: '2026-01-02' })

    await asUser.mutation(api.expenses.remove, { id: expenseToDelete })

    const category = await t.run(async (ctx) => ctx.db.get('categories', categoryId))
    expect(category).not.toBeNull()
  })

  it('cleans up orphaned merchant on deletion', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)

    // Create a merchant record
    await t.run(async (ctx) => {
      await ctx.db.insert('merchants', {
        name: 'Unique Merchant',
        normalizedName: 'unique merchant',
        userId,
      })
    })

    const expenseId = await insertExpense(t, userId, categoryId, { merchant: 'Unique Merchant' })

    await asUser.mutation(api.expenses.remove, { id: expenseId })

    const merchants = await t.run(async (ctx) =>
      ctx.db
        .query('merchants')
        .filter((q) => q.eq(q.field('userId'), userId))
        .collect(),
    )
    expect(merchants).toHaveLength(0)
  })
})

// ── removeAttachment ────────────────────────────────────────────────────

describe('expenses.removeAttachment', () => {
  it('rejects unauthenticated calls', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)
    const expenseId = await insertExpense(t, userId, categoryId)

    await expect(t.mutation(api.expenses.removeAttachment, { id: expenseId })).rejects.toThrow(
      'Not authenticated',
    )
  })

  it('rejects when the expense belongs to another user', async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id } = await setupAuthenticatedUser(t)
    const { asUser: asUser2 } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, user1Id)
    const expenseId = await insertExpense(t, user1Id, categoryId)

    await expect(
      asUser2.mutation(api.expenses.removeAttachment, { id: expenseId }),
    ).rejects.toThrow('Expense not found')
  })

  it('removes attachment from the expense and cleans up upload record', async () => {
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

    await asUser.mutation(api.expenses.removeAttachment, { id: expenseId })

    const expense = await t.run(async (ctx) => ctx.db.get('expenses', expenseId))
    expect(expense?.attachmentId).toBeUndefined()

    const uploadRecord = await t.run(async (ctx) =>
      ctx.db
        .query('uploads')
        .filter((q) => q.eq(q.field('storageId'), storageId))
        .first(),
    )
    expect(uploadRecord).toBeNull()
  })

  it('is a no-op when the expense has no attachment', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)
    const expenseId = await insertExpense(t, userId, categoryId)

    // Should not throw
    await asUser.mutation(api.expenses.removeAttachment, { id: expenseId })

    const expense = await t.run(async (ctx) => ctx.db.get('expenses', expenseId))
    expect(expense).not.toBeNull()
    expect(expense?.attachmentId).toBeUndefined()
  })
})

// ── update — auth & ownership ─────────────────────────────────────────

describe('expenses.update', () => {
  it('rejects unauthenticated calls', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)
    const expenseId = await insertExpense(t, userId, categoryId)

    await expect(
      t.mutation(api.expenses.update, {
        id: expenseId,
        ...VALID_EXPENSE_FIELDS,
        newCategoryName: 'Test',
      }),
    ).rejects.toThrow('Not authenticated')
  })

  it("rejects updates to another user's expense", async () => {
    const t = convexTest(schema, modules)
    const { userId: user1Id } = await setupAuthenticatedUser(t)
    const { asUser: asUser2 } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, user1Id)
    const expenseId = await insertExpense(t, user1Id, categoryId)

    await expect(
      asUser2.mutation(api.expenses.update, {
        id: expenseId,
        ...VALID_EXPENSE_FIELDS,
        newCategoryName: 'Test',
      }),
    ).rejects.toThrow('Expense not found')
  })

  it('updates an owned expense successfully', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const categoryId = await setupCategory(t, userId)
    const expenseId = await insertExpense(t, userId, categoryId)

    await asUser.mutation(api.expenses.update, {
      id: expenseId,
      date: '2026-06-15',
      merchant: 'Updated Merchant',
      amount: 9999,
      categoryId,
    })

    const updated = await t.run(async (ctx) => ctx.db.get('expenses', expenseId))
    expect(updated).toMatchObject({
      date: '2026-06-15',
      merchant: 'Updated Merchant',
      amount: 9999,
    })
  })
})

// ── update — attachment handling ────────────────────────────────────────

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
