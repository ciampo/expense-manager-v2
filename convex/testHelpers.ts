import type { TestConvex } from 'convex-test'
import type { Id } from './_generated/dataModel'
import type schema from './schema'

export type TestCtx = TestConvex<typeof schema>

/**
 * Issue an HTTP request against a Convex HTTP action route.
 *
 * `convex-test` exposes a `fetch` method at runtime for HTTP action testing,
 * but the `TestConvex` type doesn't include it — hence the cast.
 */
export function fetchApi(t: TestCtx, path: string, init: RequestInit): Promise<Response> {
  return (t as never as { fetch: (p: string, i: RequestInit) => Promise<Response> }).fetch(
    path,
    init,
  )
}

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
 * Defaults to `source: "auto"` to match the most common test scenario
 * (categories created via expense upsert that are eligible for cleanup).
 */
export async function setupCategory(
  t: TestCtx,
  userId: Id<'users'>,
  name = 'Test Category',
  source: 'manual' | 'auto' = 'auto',
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('categories', {
      name,
      normalizedName: name.trim().toLowerCase(),
      userId,
      source,
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
      isDraft: false,
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
 * Insert a draft expense with sensible defaults. Override any field via `overrides`.
 */
export async function insertDraft(
  t: TestCtx,
  userId: Id<'users'>,
  overrides: Partial<{
    date: string
    merchant: string
    amount: number
    categoryId: Id<'categories'>
    attachmentId: Id<'_storage'>
    comment: string
  }> = {},
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert('expenses', {
      userId,
      isDraft: true,
      ...(overrides.date !== undefined ? { date: overrides.date } : {}),
      ...(overrides.merchant !== undefined ? { merchant: overrides.merchant } : {}),
      ...(overrides.amount !== undefined ? { amount: overrides.amount } : {}),
      ...(overrides.categoryId !== undefined ? { categoryId: overrides.categoryId } : {}),
      ...(overrides.attachmentId !== undefined ? { attachmentId: overrides.attachmentId } : {}),
      ...(overrides.comment !== undefined ? { comment: overrides.comment } : {}),
      createdAt: Date.now(),
    })
  })
}

/**
 * Insert a draft expense. Mirrors `insertExpense` but with `isDraft: true`.
 * All fields default to valid values so the draft can be "completed" by
 * patching `isDraft` to `false` without further changes.
 */
export async function insertDraftExpense(
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
      isDraft: true,
      date: overrides.date ?? '2026-03-01',
      merchant: overrides.merchant ?? 'Draft Merchant',
      amount: overrides.amount ?? 2500,
      categoryId,
      ...(overrides.attachmentId !== undefined ? { attachmentId: overrides.attachmentId } : {}),
      createdAt: Date.now(),
    })
  })
}

/**
 * Patch a draft expense to mark it as complete (`isDraft: false`).
 */
export async function markDraftComplete(t: TestCtx, expenseId: Id<'expenses'>) {
  await t.run(async (ctx) => {
    await ctx.db.patch('expenses', expenseId, { isDraft: false })
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

// ── API key helpers ─────────────────────────────────────────────────────

export async function sha256Hex(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const DEFAULT_TEST_RAW_KEY = 'em_' + 'a'.repeat(64)

/**
 * Insert an API key record for direct DB-level test setup.
 * Returns the raw key string for use in `Authorization: Bearer` headers.
 */
export async function setupApiKey(t: TestCtx, userId: Id<'users'>, rawKey = DEFAULT_TEST_RAW_KEY) {
  const hashedKey = await sha256Hex(rawKey)
  await t.run(async (ctx) => {
    await ctx.db.insert('apiKeys', {
      userId,
      hashedKey,
      prefix: rawKey.slice(0, 8),
      name: 'Test Key',
      createdAt: Date.now(),
    })
  })
  return rawKey
}
