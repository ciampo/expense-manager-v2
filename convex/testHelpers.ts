import { convexTest } from 'convex-test'
import type { Id } from './_generated/dataModel'

export type TestCtx = ReturnType<typeof convexTest>

/**
 * Create an authenticated test context.
 *
 * Inserts a user into the database and returns a `withIdentity` accessor
 * whose `auth.getUserId` resolves to that user.
 *
 * `@convex-dev/auth` reads the user ID from the first segment of
 * `identity.subject` (split by "|").
 */
export async function setupAuthenticatedUser(t: TestCtx) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert('users', {})
  })
  const asUser = t.withIdentity({ subject: `${userId}|fake-session` })
  return { userId, asUser }
}

/**
 * Insert a user-owned category. Returns the category ID.
 */
export async function setupCategory(t: TestCtx, userId: Id<'users'>, name = 'Test Category') {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('categories', {
      name,
      normalizedName: name.trim().toLowerCase(),
      userId,
    })
  })
}

/**
 * Insert an expense with sensible defaults. Override any field via `overrides`.
 */
export async function insertExpense(
  t: TestCtx,
  userId: Id<'users'>,
  categoryId: Id<'categories'>,
  overrides: Partial<{
    date: string
    merchant: string
    amount: number
    attachmentId: Id<'_storage'>
  }> = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('expenses', {
      userId,
      date: overrides.date ?? '2026-03-01',
      merchant: overrides.merchant ?? 'Test Merchant',
      amount: overrides.amount ?? 2500,
      categoryId,
      ...(overrides.attachmentId !== undefined ? { attachmentId: overrides.attachmentId } : {}),
      createdAt: Date.now(),
    })
  })
}

/**
 * Store a blob in Convex storage. Returns the storage ID.
 */
export async function setupStorageFile(t: TestCtx, content: BlobPart = 'test-content') {
  return await t.run(async (ctx) => {
    return await ctx.storage.store(new Blob([content]))
  })
}

/**
 * Insert an upload ownership record. `createdAt` defaults to `Date.now()` but
 * can be overridden to simulate stale records for cron cleanup tests.
 */
export async function setupUploadRecord(
  t: TestCtx,
  storageId: Id<'_storage'>,
  userId: Id<'users'>,
  createdAt = Date.now(),
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('uploads', {
      storageId,
      userId,
      createdAt,
    })
  })
}
