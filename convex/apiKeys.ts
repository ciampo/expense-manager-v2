import { v } from 'convex/values'
import { mutation, query, internalMutation } from './_generated/server'
import { auth } from './auth'
import { rateLimiter, formatRetryDelay } from './rateLimits'
import { validateApiKeyName } from './validation'

const API_KEY_PREFIX = 'em_'
const DISPLAY_PREFIX_LENGTH = 8 // first 8 chars of raw key shown in UI
const MAX_API_KEYS_PER_USER = 25

async function sha256Hex(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateRawKey(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${API_KEY_PREFIX}${hex}`
}

/**
 * Create a new API key. Returns the raw key exactly once — the caller
 * must copy it immediately because only the SHA-256 hash is persisted.
 */
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    const name = validateApiKeyName(args.name)

    const { ok, retryAfter } = await rateLimiter.limit(ctx, 'apiKeyCreate', {
      key: userId,
    })
    if (!ok) {
      throw new Error(
        `Too many API key creation attempts. Please try again in ${formatRetryDelay(retryAfter)}.`,
      )
    }

    const existing = await ctx.db
      .query('apiKeys')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    if (existing.length >= MAX_API_KEYS_PER_USER) {
      throw new Error(`You can have at most ${MAX_API_KEYS_PER_USER} API keys.`)
    }
    const rawKey = generateRawKey()
    const hashedKey = await sha256Hex(rawKey)
    const prefix = rawKey.slice(0, DISPLAY_PREFIX_LENGTH)

    await ctx.db.insert('apiKeys', {
      userId,
      hashedKey,
      prefix,
      name,
      createdAt: Date.now(),
    })

    return { rawKey }
  },
})

/**
 * List the current user's API keys. Never exposes the hash.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) return []

    const keys = await ctx.db
      .query('apiKeys')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    return keys
      .sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime)
      .map((k) => ({
        _id: k._id,
        name: k.name,
        prefix: k.prefix,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
      }))
  },
})

/**
 * Revoke (delete) an API key. Only the owner can revoke their own keys.
 */
export const revoke = mutation({
  args: { id: v.id('apiKeys') },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    const key = await ctx.db.get(args.id)
    if (!key || key.userId !== userId) {
      throw new Error('API key not found')
    }

    await ctx.db.delete(args.id)
  },
})

/**
 * Verify an API key by its raw value. Updates `lastUsedAt` on success.
 *
 * Internal-only — called by the REST API HTTP action, never exposed
 * to clients directly.
 *
 * Returns the userId on success, or null if the key is invalid.
 */
export const verify = internalMutation({
  args: { rawKey: v.string() },
  handler: async (ctx, args) => {
    const hashedKey = await sha256Hex(args.rawKey)

    const record = await ctx.db
      .query('apiKeys')
      .withIndex('by_hashed_key', (q) => q.eq('hashedKey', hashedKey))
      .first()

    if (!record) return null

    await ctx.db.patch(record._id, { lastUsedAt: Date.now() })
    return record.userId
  },
})
