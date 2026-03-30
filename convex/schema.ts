import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

export default defineSchema({
  ...authTables,

  expenses: defineTable({
    userId: v.id('users'),
    isDraft: v.optional(v.boolean()), // always set explicitly; optional only for legacy compat
    date: v.optional(v.string()), // ISO date string (YYYY-MM-DD)
    merchant: v.optional(v.string()), // Merchant name (autocomplete from existing)
    amount: v.optional(v.number()), // EUR cents (e.g., 1250 = €12.50)
    categoryId: v.optional(v.id('categories')),
    attachmentId: v.optional(v.id('_storage')),
    comment: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_user_and_date', ['userId', 'date'])
    .index('by_user_and_draft_and_date', ['userId', 'isDraft', 'date'])
    .index('by_user_and_attachment', ['userId', 'attachmentId'])
    .index('by_attachment', ['attachmentId'])
    .index('by_category', ['categoryId']),

  categories: defineTable({
    name: v.string(),
    normalizedName: v.optional(v.string()), // lowercased for case-insensitive dedup
    userId: v.optional(v.id('users')), // undefined/omitted = predefined, set = user custom
    icon: v.optional(v.string()),
    // "manual" = explicitly created by user in Settings (never auto-deleted)
    // "auto"   = implicitly created during expense upsert (eligible for cleanup)
    // undefined = no source set (legacy and/or predefined); treated as non-auto to avoid accidental deletion
    source: v.optional(v.union(v.literal('manual'), v.literal('auto'))),
  })
    .index('by_user_and_name', ['userId', 'name'])
    .index('by_user_and_normalized_name', ['userId', 'normalizedName']),

  merchants: defineTable({
    name: v.string(),
    normalizedName: v.string(), // lowercased for case-insensitive dedup
    userId: v.id('users'),
  }).index('by_user_and_normalized_name', ['userId', 'normalizedName']),

  apiKeys: defineTable({
    userId: v.id('users'),
    hashedKey: v.string(), // SHA-256 hex digest
    prefix: v.string(), // first 8 chars of the raw key, for display
    name: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index('by_hashed_key', ['hashedKey'])
    .index('by_user', ['userId']),

  /**
   * Tracks file uploads so we can verify ownership from the moment of upload,
   * before the file is linked to an expense. Cleaned up by a daily cron that
   * removes orphaned records older than 24 hours.
   */
  uploads: defineTable({
    storageId: v.id('_storage'),
    userId: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_storage_id', ['storageId'])
    .index('by_created_at', ['createdAt']),
})
