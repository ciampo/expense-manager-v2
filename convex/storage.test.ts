// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'
import { MAX_FILE_SIZE } from './uploadLimits'

const modules = import.meta.glob('./**/*.ts')

async function setupAuthenticatedUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert('users', {})
  })
  const asUser = t.withIdentity({ subject: `${userId}|fake-session` })
  return { userId, asUser }
}

async function storeFile(t: ReturnType<typeof convexTest>, content: BlobPart = 'test-content') {
  return await t.run(async (ctx) => {
    return await ctx.storage.store(new Blob([content]))
  })
}

// Uses .filter() instead of .withIndex() because ReturnType<typeof convexTest>
// loses schema-specific index types, causing tsc errors with custom indexes.
function getUploadRecord(t: ReturnType<typeof convexTest>, storageId: Id<'_storage'>) {
  return t.run(async (ctx) => {
    return await ctx.db
      .query('uploads')
      .filter((q) => q.eq(q.field('storageId'), storageId))
      .first()
  })
}

// convex-test does not populate contentType on system storage records, so
// confirmUpload's content-type guard always rejects in this environment.
// The tests below cover auth, ownership, size validation, and error
// messages. Content-type acceptance paths are verified via manual testing
// against a real Convex backend.

describe('storage.confirmUpload', () => {
  it('rejects unauthenticated calls', async () => {
    const t = convexTest(schema, modules)
    const storageId = await storeFile(t)

    await expect(t.mutation(api.storage.confirmUpload, { storageId })).rejects.toThrow(
      'Not authenticated',
    )
  })

  it('rejects files exceeding the size limit', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)
    const oversized = new Uint8Array(MAX_FILE_SIZE + 1)
    const storageId = await storeFile(t, oversized)

    await expect(asUser.mutation(api.storage.confirmUpload, { storageId })).rejects.toThrow(
      'File exceeds maximum size',
    )
  })

  it('rejects files with no content type', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)
    const storageId = await storeFile(t)

    await expect(asUser.mutation(api.storage.confirmUpload, { storageId })).rejects.toThrow(
      'Unsupported file type',
    )
  })

  it('rejects when another user already claimed the file via uploads table', async () => {
    const t = convexTest(schema, modules)
    const { asUser: asUser2 } = await setupAuthenticatedUser(t)
    const { userId: user1Id } = await setupAuthenticatedUser(t)
    const storageId = await storeFile(t)

    await t.run(async (ctx) => {
      await ctx.db.insert('uploads', {
        storageId,
        userId: user1Id,
        createdAt: Date.now(),
      })
    })

    await expect(asUser2.mutation(api.storage.confirmUpload, { storageId })).rejects.toThrow(
      'File already claimed by another user',
    )
  })

  it("rejects when another user's expense references the file", async () => {
    const t = convexTest(schema, modules)
    const { asUser: asUser2 } = await setupAuthenticatedUser(t)
    const { userId: user1Id } = await setupAuthenticatedUser(t)
    const storageId = await storeFile(t)

    const categoryId = await t.run(async (ctx) => {
      return await ctx.db.insert('categories', {
        name: 'Test',
        normalizedName: 'test',
        userId: user1Id,
      })
    })

    await t.run(async (ctx) => {
      await ctx.db.insert('expenses', {
        userId: user1Id,
        date: '2026-03-01',
        merchant: 'Test',
        amount: 1000,
        categoryId,
        attachmentId: storageId,
        createdAt: Date.now(),
      })
    })

    await expect(asUser2.mutation(api.storage.confirmUpload, { storageId })).rejects.toThrow(
      'File already claimed by another user',
    )
  })

  it('is idempotent when the same user already has an upload record', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const storageId = await storeFile(t)

    await t.run(async (ctx) => {
      await ctx.db.insert('uploads', {
        storageId,
        userId,
        createdAt: Date.now(),
      })
    })

    // Second call should not throw
    await asUser.mutation(api.storage.confirmUpload, { storageId })

    const uploads = await t.run(async (ctx) => {
      return await ctx.db
        .query('uploads')
        .withIndex('by_storage_id', (q) => q.eq('storageId', storageId))
        .collect()
    })
    expect(uploads).toHaveLength(1)
  })

  it('backfills upload record for legacy expense attachments without re-validating', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    // File has no contentType (would normally fail validation)
    const storageId = await storeFile(t)

    const categoryId = await t.run(async (ctx) => {
      return await ctx.db.insert('categories', {
        name: 'Legacy',
        normalizedName: 'legacy',
        userId,
      })
    })

    // Simulate legacy expense that predates validation
    await t.run(async (ctx) => {
      await ctx.db.insert('expenses', {
        userId,
        date: '2026-01-01',
        merchant: 'Legacy Shop',
        amount: 500,
        categoryId,
        attachmentId: storageId,
        createdAt: Date.now(),
      })
    })

    // confirmUpload should backfill the upload record, NOT delete/reject
    await asUser.mutation(api.storage.confirmUpload, { storageId })

    const upload = await getUploadRecord(t, storageId)
    expect(upload).not.toBeNull()
    expect(upload?.userId).toBe(userId)
  })

  it('ownership checks run before validation to protect other users files', async () => {
    const t = convexTest(schema, modules)
    const { asUser: asUser2 } = await setupAuthenticatedUser(t)
    const { userId: user1Id } = await setupAuthenticatedUser(t)
    // File has no contentType (would fail validation), but ownership check
    // should reject first with a different error message.
    const storageId = await storeFile(t)

    await t.run(async (ctx) => {
      await ctx.db.insert('uploads', {
        storageId,
        userId: user1Id,
        createdAt: Date.now(),
      })
    })

    await expect(asUser2.mutation(api.storage.confirmUpload, { storageId })).rejects.toThrow(
      'File already claimed by another user',
    )
  })
})

describe('storage.generateUploadUrl', () => {
  it('rejects unauthenticated calls', async () => {
    const t = convexTest(schema, modules)
    await expect(t.mutation(api.storage.generateUploadUrl, {})).rejects.toThrow('Not authenticated')
  })

  it('returns a URL for authenticated users', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)
    const url = await asUser.mutation(api.storage.generateUploadUrl, {})
    expect(typeof url).toBe('string')
  })
})

describe('storage.getUrl', () => {
  it('returns null for unauthenticated users', async () => {
    const t = convexTest(schema, modules)
    const storageId = await storeFile(t)
    const url = await t.query(api.storage.getUrl, { storageId })
    expect(url).toBeNull()
  })

  it('returns a URL when the user owns the upload record', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const storageId = await storeFile(t)

    await t.run(async (ctx) => {
      await ctx.db.insert('uploads', { storageId, userId, createdAt: Date.now() })
    })

    const url = await asUser.query(api.storage.getUrl, { storageId })
    expect(url).not.toBeNull()
  })

  it('returns null when the user does not own the file', async () => {
    const t = convexTest(schema, modules)
    const { asUser: asUser2 } = await setupAuthenticatedUser(t)
    const { userId: user1Id } = await setupAuthenticatedUser(t)
    const storageId = await storeFile(t)

    await t.run(async (ctx) => {
      await ctx.db.insert('uploads', { storageId, userId: user1Id, createdAt: Date.now() })
    })

    const url = await asUser2.query(api.storage.getUrl, { storageId })
    expect(url).toBeNull()
  })
})

describe('storage.deleteFile', () => {
  it('rejects unauthenticated calls', async () => {
    const t = convexTest(schema, modules)
    const storageId = await storeFile(t)
    await expect(t.mutation(api.storage.deleteFile, { storageId })).rejects.toThrow(
      'Not authenticated',
    )
  })

  it('rejects when the user has no expense referencing the file', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)
    const storageId = await storeFile(t)
    await expect(asUser.mutation(api.storage.deleteFile, { storageId })).rejects.toThrow(
      'File not found or not owned by current user',
    )
  })

  it('deletes the file and clears the expense attachment', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const storageId = await storeFile(t)

    const categoryId = await t.run(async (ctx) => {
      return await ctx.db.insert('categories', {
        name: 'Cat',
        normalizedName: 'cat',
        userId,
      })
    })

    const expenseId = await t.run(async (ctx) => {
      await ctx.db.insert('uploads', { storageId, userId, createdAt: Date.now() })
      return await ctx.db.insert('expenses', {
        userId,
        date: '2026-03-01',
        merchant: 'Test',
        amount: 1000,
        categoryId,
        attachmentId: storageId,
        createdAt: Date.now(),
      })
    })

    await asUser.mutation(api.storage.deleteFile, { storageId })

    const expense = await t.run(async (ctx) => ctx.db.get('expenses', expenseId))
    expect(expense?.attachmentId).toBeUndefined()

    const upload = await getUploadRecord(t, storageId)
    expect(upload).toBeNull()
  })
})
