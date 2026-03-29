// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import rateLimiterTesting from '@convex-dev/rate-limiter/test'
import { setupAuthenticatedUser, type TestCtx } from './testHelpers'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registerRateLimiter = (t: TestCtx) => rateLimiterTesting.register(t as any)

const modules = import.meta.glob('./**/*.ts')

const API_KEY_PREFIX = 'em_'
const EXPECTED_RAW_KEY_LENGTH = 67 // "em_" (3) + 64 hex chars

async function createKey(
  asUser: Awaited<ReturnType<typeof setupAuthenticatedUser>>['asUser'],
  name = 'Test Key',
) {
  return await asUser.mutation(api.apiKeys.create, { name })
}

// ── create ────────────────────────────────────────────────────────────────

describe('apiKeys.create', () => {
  it('returns a raw key with the em_ prefix and correct length', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser } = await setupAuthenticatedUser(t)

    const { rawKey } = await createKey(asUser)

    expect(rawKey).toMatch(new RegExp(`^${API_KEY_PREFIX}`))
    expect(rawKey).toHaveLength(EXPECTED_RAW_KEY_LENGTH)
  })

  it('stores the key hash, prefix, and name — never the raw key', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    const { rawKey } = await createKey(asUser, 'My Key')

    const records = await t.run(async (ctx) => {
      return await ctx.db
        .query('apiKeys')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect()
    })

    expect(records).toHaveLength(1)
    const record = records[0]
    expect(record.name).toBe('My Key')
    expect(record.prefix).toBe(rawKey.slice(0, 8))
    expect(record.hashedKey).not.toBe(rawKey)
    expect(record.hashedKey).toHaveLength(64) // SHA-256 hex
  })

  it('trims the key name', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    await createKey(asUser, '  Padded Name  ')

    const records = await t.run(async (ctx) => {
      return await ctx.db
        .query('apiKeys')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect()
    })
    expect(records[0].name).toBe('Padded Name')
  })

  it('rejects empty name', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser } = await setupAuthenticatedUser(t)

    await expect(createKey(asUser, '')).rejects.toThrow('API key name is required')
  })

  it('rejects whitespace-only name', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser } = await setupAuthenticatedUser(t)

    await expect(createKey(asUser, '   ')).rejects.toThrow('API key name is required')
  })

  it('rejects name exceeding max length', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser } = await setupAuthenticatedUser(t)

    await expect(createKey(asUser, 'a'.repeat(101))).rejects.toThrow('100 characters or less')
  })

  it('rejects creation beyond per-user limit', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    await t.run(async (ctx) => {
      for (let i = 0; i < 25; i++) {
        await ctx.db.insert('apiKeys', {
          userId,
          hashedKey: `hash_${i}`.padEnd(64, '0'),
          prefix: `em_${String(i).padStart(5, '0')}`,
          name: `Key ${i}`,
          createdAt: Date.now(),
        })
      }
    })

    await expect(createKey(asUser, 'One too many')).rejects.toThrow('at most 25 API keys')
  })

  it('rejects unauthenticated calls', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)

    await expect(t.mutation(api.apiKeys.create, { name: 'Test' })).rejects.toThrow(
      'Not authenticated',
    )
  })
})

// ── list ──────────────────────────────────────────────────────────────────

describe('apiKeys.list', () => {
  it('returns prefix, name, and dates — never the hash', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser } = await setupAuthenticatedUser(t)

    await createKey(asUser, 'List Key')

    const keys = await asUser.query(api.apiKeys.list, {})

    expect(keys).toHaveLength(1)
    const key = keys[0]
    expect(key.name).toBe('List Key')
    expect(key.prefix).toBeDefined()
    expect(key.createdAt).toBeTypeOf('number')
    expect(key).not.toHaveProperty('hashedKey')
    expect(key).not.toHaveProperty('userId')
  })

  it('returns keys sorted newest first', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser } = await setupAuthenticatedUser(t)

    await createKey(asUser, 'First')
    await createKey(asUser, 'Second')

    const keys = await asUser.query(api.apiKeys.list, {})
    expect(keys[0].name).toBe('Second')
    expect(keys[1].name).toBe('First')
  })

  it('returns empty array for unauthenticated users', async () => {
    const t = convexTest(schema, modules)

    const keys = await t.query(api.apiKeys.list, {})
    expect(keys).toEqual([])
  })

  it('does not return keys from other users', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser: asUserA } = await setupAuthenticatedUser(t)
    const { asUser: asUserB } = await setupAuthenticatedUser(t)

    await createKey(asUserA, 'User A Key')

    const keysB = await asUserB.query(api.apiKeys.list, {})
    expect(keysB).toHaveLength(0)
  })
})

// ── revoke ────────────────────────────────────────────────────────────────

describe('apiKeys.revoke', () => {
  it('deletes the key record', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser } = await setupAuthenticatedUser(t)

    await createKey(asUser)
    const keys = await asUser.query(api.apiKeys.list, {})
    expect(keys).toHaveLength(1)

    await asUser.mutation(api.apiKeys.revoke, { id: keys[0]._id })

    const remaining = await asUser.query(api.apiKeys.list, {})
    expect(remaining).toHaveLength(0)
  })

  it("cannot revoke another user's key", async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser: asUserA } = await setupAuthenticatedUser(t)
    const { asUser: asUserB } = await setupAuthenticatedUser(t)

    await createKey(asUserA)
    const keysA = await asUserA.query(api.apiKeys.list, {})

    await expect(asUserB.mutation(api.apiKeys.revoke, { id: keysA[0]._id })).rejects.toThrow(
      'API key not found',
    )
  })

  it('rejects unauthenticated calls', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser } = await setupAuthenticatedUser(t)

    await createKey(asUser)
    const keys = await asUser.query(api.apiKeys.list, {})

    await expect(t.mutation(api.apiKeys.revoke, { id: keys[0]._id })).rejects.toThrow(
      'Not authenticated',
    )
  })
})

// ── verify ────────────────────────────────────────────────────────────────

describe('apiKeys.verify', () => {
  it('returns userId for a valid key', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { userId, asUser } = await setupAuthenticatedUser(t)

    const { rawKey } = await createKey(asUser)

    const result = await t.mutation(internal.apiKeys.verify, { rawKey })
    expect(result).toBe(userId)
  })

  it('returns null for an invalid key', async () => {
    const t = convexTest(schema, modules)

    const result = await t.mutation(internal.apiKeys.verify, { rawKey: 'em_invalid' })
    expect(result).toBeNull()
  })

  it('returns null for a revoked key', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser } = await setupAuthenticatedUser(t)

    const { rawKey } = await createKey(asUser)
    const keys = await asUser.query(api.apiKeys.list, {})
    await asUser.mutation(api.apiKeys.revoke, { id: keys[0]._id })

    const result = await t.mutation(internal.apiKeys.verify, { rawKey })
    expect(result).toBeNull()
  })

  it('updates lastUsedAt on successful verification', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser } = await setupAuthenticatedUser(t)

    const { rawKey } = await createKey(asUser)

    // Initially lastUsedAt is undefined
    const before = await asUser.query(api.apiKeys.list, {})
    expect(before[0].lastUsedAt).toBeUndefined()

    await t.mutation(internal.apiKeys.verify, { rawKey })

    const after = await asUser.query(api.apiKeys.list, {})
    expect(after[0].lastUsedAt).toBeTypeOf('number')
  })

  it('does not update lastUsedAt on failed verification', async () => {
    const t = convexTest(schema, modules)
    registerRateLimiter(t)
    const { asUser } = await setupAuthenticatedUser(t)

    await createKey(asUser)

    await t.mutation(internal.apiKeys.verify, { rawKey: 'em_wrong_key' })

    const keys = await asUser.query(api.apiKeys.list, {})
    expect(keys[0].lastUsedAt).toBeUndefined()
  })
})
