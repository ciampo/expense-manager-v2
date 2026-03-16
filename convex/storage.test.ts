// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import type { Id } from './_generated/dataModel'
import { ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE } from './uploadLimits'
import { validateFileMetadata } from './storage'
import {
  setupAuthenticatedUser,
  setupCategory,
  setupStorageFile,
  setupUploadRecord,
  insertExpense,
} from './testHelpers'

const modules = import.meta.glob('./**/*.ts')

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

// ── validateFileMetadata (pure function — no convex-test limitations) ────

describe('validateFileMetadata', () => {
  it('returns null for a valid JPEG', () => {
    expect(validateFileMetadata({ size: 1024, contentType: 'image/jpeg' })).toBeNull()
  })

  it('returns null for a valid PDF', () => {
    expect(
      validateFileMetadata({ size: 5 * 1024 * 1024, contentType: 'application/pdf' }),
    ).toBeNull()
  })

  it('accepts all allowed content types', () => {
    for (const contentType of ALLOWED_CONTENT_TYPES) {
      expect(validateFileMetadata({ size: 100, contentType })).toBeNull()
    }
  })

  it('rejects files exceeding the size limit', () => {
    const result = validateFileMetadata({ size: MAX_FILE_SIZE + 1, contentType: 'image/jpeg' })
    expect(result).toMatch(/exceeds maximum size/)
  })

  it('accepts files at exactly the size limit', () => {
    expect(validateFileMetadata({ size: MAX_FILE_SIZE, contentType: 'image/jpeg' })).toBeNull()
  })

  it('rejects disallowed content types', () => {
    expect(validateFileMetadata({ size: 100, contentType: 'text/plain' })).toMatch(
      /Unsupported file type/,
    )
    expect(validateFileMetadata({ size: 100, contentType: 'application/zip' })).toMatch(
      /Unsupported file type/,
    )
    expect(validateFileMetadata({ size: 100, contentType: 'video/mp4' })).toMatch(
      /Unsupported file type/,
    )
  })

  it('rejects missing content type', () => {
    expect(validateFileMetadata({ size: 100, contentType: null })).toMatch(/Unsupported file type/)
    expect(validateFileMetadata({ size: 100, contentType: undefined })).toMatch(
      /Unsupported file type/,
    )
  })

  it('rejects empty string content type', () => {
    expect(validateFileMetadata({ size: 100, contentType: '' })).toMatch(/Unsupported file type/)
  })

  it('checks size before content type', () => {
    const result = validateFileMetadata({ size: MAX_FILE_SIZE + 1, contentType: 'text/plain' })
    expect(result).toMatch(/exceeds maximum size/)
  })

  it('skips size check when size is null/undefined', () => {
    expect(validateFileMetadata({ size: null, contentType: 'image/jpeg' })).toBeNull()
    expect(validateFileMetadata({ size: undefined, contentType: 'image/jpeg' })).toBeNull()
  })
})

// ── confirmUpload integration tests ──────────────────────────────────────
//
// convex-test does not populate `contentType` on system storage records,
// so confirmUpload's metadata-validation branch (unclaimed new files)
// always rejects with "Unsupported file type". The content-type happy
// path is tested via the pure validateFileMetadata helper above.
//
// Other confirmUpload branches — idempotent already-claimed uploads and
// legacy expense-attachment backfills — bypass re-validation and are
// tested normally below.

describe('storage.confirmUpload', () => {
  it('rejects unauthenticated calls', async () => {
    const t = convexTest(schema, modules)
    const storageId = await setupStorageFile(t)

    await expect(t.mutation(api.storage.confirmUpload, { storageId })).rejects.toThrow(
      'Not authenticated',
    )
  })

  it('rejects files exceeding the size limit', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)
    const oversized = new Uint8Array(MAX_FILE_SIZE + 1)
    const storageId = await setupStorageFile(t, oversized)

    await expect(asUser.mutation(api.storage.confirmUpload, { storageId })).rejects.toThrow(
      'File exceeds maximum size',
    )
  })

  it('rejects files with no content type', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)
    const storageId = await setupStorageFile(t)

    await expect(asUser.mutation(api.storage.confirmUpload, { storageId })).rejects.toThrow(
      'Unsupported file type',
    )
  })

  it('rejects when another user already claimed the file via uploads table', async () => {
    const t = convexTest(schema, modules)
    const { asUser: asUser2 } = await setupAuthenticatedUser(t)
    const { userId: user1Id } = await setupAuthenticatedUser(t)
    const storageId = await setupStorageFile(t)

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
    const storageId = await setupStorageFile(t)

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
    const storageId = await setupStorageFile(t)

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
    const storageId = await setupStorageFile(t)

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
    const storageId = await setupStorageFile(t)

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
    const storageId = await setupStorageFile(t)
    const url = await t.query(api.storage.getUrl, { storageId })
    expect(url).toBeNull()
  })

  it('returns a URL when the user owns the upload record', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const storageId = await setupStorageFile(t)

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
    const storageId = await setupStorageFile(t)

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
    const storageId = await setupStorageFile(t)
    await expect(t.mutation(api.storage.deleteFile, { storageId })).rejects.toThrow(
      'Not authenticated',
    )
  })

  it('rejects when the user has no expense referencing the file', async () => {
    const t = convexTest(schema, modules)
    const { asUser } = await setupAuthenticatedUser(t)
    const storageId = await setupStorageFile(t)
    await expect(asUser.mutation(api.storage.deleteFile, { storageId })).rejects.toThrow(
      'File not found or not owned by current user',
    )
  })

  it('deletes the file and clears the expense attachment', async () => {
    const t = convexTest(schema, modules)
    const { userId, asUser } = await setupAuthenticatedUser(t)
    const storageId = await setupStorageFile(t)

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

// ── cleanupOrphanedUploads (internal cron mutation) ─────────────────────
//
// Uses fake timers to advance Date.now() past the 24 h TTL so the cleanup
// function sees records as "stale". For Pass 2, files are stored before
// the clock advances so their _creationTime falls before the cutoff.

const TWENTY_FIVE_HOURS_MS = 25 * 60 * 60 * 1000

describe('storage.cleanupOrphanedUploads', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('deletes orphaned upload record and storage file (Pass 1)', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const storageId = await setupStorageFile(t)

    // Record created "now" — will be stale once we advance the clock
    await setupUploadRecord(t, storageId, userId)

    vi.advanceTimersByTime(TWENTY_FIVE_HOURS_MS)
    await t.mutation(internal.storage.cleanupOrphanedUploads, {})

    const upload = await getUploadRecord(t, storageId)
    expect(upload).toBeNull()

    const url = await t.run(async (ctx) => ctx.storage.getUrl(storageId))
    expect(url).toBeNull()
  })

  it('removes stale upload record but keeps file when expense references it (Pass 1)', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const storageId = await setupStorageFile(t)
    const categoryId = await setupCategory(t, userId)

    await setupUploadRecord(t, storageId, userId)
    await insertExpense(t, userId, categoryId, { attachmentId: storageId })

    vi.advanceTimersByTime(TWENTY_FIVE_HOURS_MS)
    await t.mutation(internal.storage.cleanupOrphanedUploads, {})

    // Upload record removed (stale), but file still exists
    const upload = await getUploadRecord(t, storageId)
    expect(upload).toBeNull()

    const url = await t.run(async (ctx) => ctx.storage.getUrl(storageId))
    expect(url).not.toBeNull()
  })

  it('deletes untracked orphaned storage files (Pass 2)', async () => {
    const t = convexTest(schema, modules)
    // Store file — no upload record, no expense reference
    const storageId = await setupStorageFile(t)

    vi.advanceTimersByTime(TWENTY_FIVE_HOURS_MS)
    await t.mutation(internal.storage.cleanupOrphanedUploads, {})

    const url = await t.run(async (ctx) => ctx.storage.getUrl(storageId))
    expect(url).toBeNull()
  })

  it('skips untracked files that are referenced by an expense (Pass 2)', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const storageId = await setupStorageFile(t)
    const categoryId = await setupCategory(t, userId)

    // No upload record, but an expense references the file
    await insertExpense(t, userId, categoryId, { attachmentId: storageId })

    vi.advanceTimersByTime(TWENTY_FIVE_HOURS_MS)
    await t.mutation(internal.storage.cleanupOrphanedUploads, {})

    const url = await t.run(async (ctx) => ctx.storage.getUrl(storageId))
    expect(url).not.toBeNull()
  })

  it('skips files that still have an upload record (Pass 2)', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const storageId = await setupStorageFile(t)

    // Fresh upload record (created after clock advance = within TTL)
    vi.advanceTimersByTime(TWENTY_FIVE_HOURS_MS)
    await setupUploadRecord(t, storageId, userId)

    await t.mutation(internal.storage.cleanupOrphanedUploads, {})

    // File still exists — Pass 2 skips files that have upload records
    const url = await t.run(async (ctx) => ctx.storage.getUrl(storageId))
    expect(url).not.toBeNull()
  })

  it('leaves fresh uploads untouched', async () => {
    const t = convexTest(schema, modules)
    const { userId } = await setupAuthenticatedUser(t)
    const storageId = await setupStorageFile(t)

    await setupUploadRecord(t, storageId, userId)

    // Don't advance clock — records are within TTL
    await t.mutation(internal.storage.cleanupOrphanedUploads, {})

    const upload = await getUploadRecord(t, storageId)
    expect(upload).not.toBeNull()

    const url = await t.run(async (ctx) => ctx.storage.getUrl(storageId))
    expect(url).not.toBeNull()
  })
})
