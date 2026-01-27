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
    .index('by_user', ['userId'])
    .index('by_user_and_date', ['userId', 'date']),

  categories: defineTable({
    name: v.string(),
    userId: v.optional(v.id('users')), // null/undefined = predefined, set = user custom
    icon: v.optional(v.string()),
  }).index('by_user', ['userId']),
})
