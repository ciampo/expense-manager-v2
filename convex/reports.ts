import { v } from 'convex/values'
import { query } from './_generated/server'
import { auth } from './auth'

/**
 * Get expenses for a specific month
 */
export const monthlyData = query({
  args: {
    year: v.number(),
    month: v.number(), // 1-12
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return { expenses: [], categories: {}, total: 0 }
    }

    // Format month with leading zero
    const monthStr = args.month.toString().padStart(2, '0')
    const startDate = `${args.year}-${monthStr}-01`
    const endDate = `${args.year}-${monthStr}-31` // This works because string comparison

    // Get all expenses for the month using the composite date index
    const expenses = await ctx.db
      .query('expenses')
      .withIndex('by_user_and_date', (q) =>
        q.eq('userId', userId).gte('date', startDate).lte('date', endDate),
      )
      .collect()

    // Collect unique category IDs from this month's expenses
    const categoryIds = [...new Set(expenses.map((e) => e.categoryId))]
    // Fetch only the categories referenced by these expenses
    const categories = await Promise.all(categoryIds.map((id) => ctx.db.get(id)))
    // Defense-in-depth: only allow predefined categories (no userId) or
    // categories owned by the current user. Treat others as missing/Unknown.
    const categoryMap = new Map(
      categories
        .filter((c) => c && (c.userId === undefined || c.userId === userId))
        .map((c) => [c!._id, c!])
    )

    // Calculate totals by category
    const categoryTotals: Record<string, { name: string; total: number; count: number }> = {}
    let total = 0

    for (const expense of expenses) {
      total += expense.amount
      const category = categoryMap.get(expense.categoryId)
      const categoryName = category?.name || 'Unknown'

      if (!categoryTotals[categoryName]) {
        categoryTotals[categoryName] = { name: categoryName, total: 0, count: 0 }
      }
      categoryTotals[categoryName].total += expense.amount
      categoryTotals[categoryName].count += 1
    }

    // Enrich expenses with category names
    const enrichedExpenses = expenses.map((expense) => ({
      ...expense,
      categoryName: categoryMap.get(expense.categoryId)?.name || 'Unknown',
    }))

    // Sort by date
    enrichedExpenses.sort((a, b) => a.date.localeCompare(b.date))

    return {
      expenses: enrichedExpenses,
      categories: categoryTotals,
      total,
    }
  },
})

/**
 * Get attachment URLs for expenses in a month (for ZIP download)
 */
export const monthlyAttachments = query({
  args: {
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return []
    }

    const monthStr = args.month.toString().padStart(2, '0')
    const startDate = `${args.year}-${monthStr}-01`
    const endDate = `${args.year}-${monthStr}-31`

    const expenses = await ctx.db
      .query('expenses')
      .withIndex('by_user_and_date', (q) =>
        q.eq('userId', userId).gte('date', startDate).lte('date', endDate),
      )
      .filter((q) => q.neq(q.field('attachmentId'), undefined))
      .collect()

    // Get URLs for all attachments
    const attachments = await Promise.all(
      expenses
        .filter((e) => e.attachmentId)
        .map(async (expense) => {
          const url = await ctx.storage.getUrl(expense.attachmentId!)
          return {
            expenseId: expense._id,
            date: expense.date,
            merchant: expense.merchant,
            url,
            storageId: expense.attachmentId!,
          }
        })
    )

    return attachments.filter((a) => a.url !== null)
  },
})
