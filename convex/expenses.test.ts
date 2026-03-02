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
    return await ctx.db.insert('categories', { name: 'Test Category', userId })
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

const VALID_EXPENSE_FIELDS = {
  date: '2026-03-01',
  merchant: 'Test Merchant',
  amount: 2500,
} as const

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
