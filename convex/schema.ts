import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { authTables } from '@convex-dev/auth/server'

export default defineSchema({
  ...authTables,

  expenses: defineTable({
    userId: v.id('users'),
    date: v.string(), // ISO date string (YYYY-MM-DD)
    merchant: v.string(), // Merchant name (autocomplete from existing)
    amount: v.number(), // EUR cents (e.g., 1250 = €12.50)
    categoryId: v.id('categories'),
    attachmentId: v.optional(v.id('_storage')),
    comment: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_user_and_date', ['userId', 'date'])
    .index('by_user_and_attachment', ['userId', 'attachmentId'])
    .index('by_attachment', ['attachmentId']),

  categories: defineTable({
    name: v.string(),
    normalizedName: v.optional(v.string()), // lowercased for case-insensitive dedup
    userId: v.optional(v.id('users')), // undefined/omitted = predefined, set = user custom
    icon: v.optional(v.string()),
  })
    .index('by_user_and_name', ['userId', 'name'])
    .index('by_user_and_normalized_name', ['userId', 'normalizedName']),

  merchants: defineTable({
    name: v.string(),
    normalizedName: v.string(), // lowercased for case-insensitive dedup
    userId: v.id('users'),
  }).index('by_user_and_normalized_name', ['userId', 'normalizedName']),

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
