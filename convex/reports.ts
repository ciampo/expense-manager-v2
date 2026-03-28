import { v } from 'convex/values'
import { query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { auth } from './auth'

export function validateYearMonth(year: number, month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be an integer between 1 and 12.`)
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Invalid year: ${year}. Must be an integer between 2000 and 2100.`)
  }
}

/**
 * Convert "YYYY-MM" keys into { year, month } objects sorted newest first.
 */
function sortedMonthsFromKeys(monthKeys: Iterable<string>): { year: number; month: number }[] {
  return Array.from(monthKeys)
    .map((key) => {
      const [year, month] = key.split('-').map(Number)
      return { year, month }
    })
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
}

/**
 * Extract distinct { year, month } pairs from an array of ISO date strings,
 * sorted newest first. Pure function, safe to call from tests.
 */
export function distinctMonthsFromDates(dates: string[]): { year: number; month: number }[] {
  const monthSet = new Set<string>()
  for (const date of dates) {
    const [year, month] = date.split('-')
    monthSet.add(`${year}-${month}`)
  }
  return sortedMonthsFromKeys(monthSet)
}

/**
 * Get the distinct months for which the user has expense data.
 * Returns an array of { year, month } objects sorted newest first.
 *
 * Leverages the by_user_and_date index ordering: instead of reading every
 * expense, we fetch only the latest expense in each month and then skip
 * ahead to the previous month boundary. This makes the query O(M) where
 * M = number of distinct months, rather than O(N) for total expenses.
 */
export const availableMonths = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx)
    if (!userId) {
      return []
    }

    const monthSet = new Set<string>()
    let upperBound: string | undefined = undefined

    while (true) {
      const expense = await ctx.db
        .query('expenses')
        .withIndex('by_user_and_date', (q) => {
          const base = q.eq('userId', userId)
          return upperBound ? base.lt('date', upperBound) : base
        })
        .order('desc')
        .first()

      if (!expense || !expense.date) break

      const [year, month] = expense.date.split('-')
      monthSet.add(`${year}-${month}`)
      upperBound = `${year}-${month}-01`
    }

    return sortedMonthsFromKeys(monthSet)
  },
})

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

    validateYearMonth(args.year, args.month)

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

    // Collect unique category IDs from this month's expenses (skip drafts without a category)
    const categoryIds = [
      ...new Set(expenses.map((e) => e.categoryId).filter((id): id is Id<'categories'> => !!id)),
    ]
    // Fetch only the categories referenced by these expenses
    const categories = await Promise.all(categoryIds.map((id) => ctx.db.get('categories', id)))
    // Defense-in-depth: only allow predefined categories (no userId) or
    // categories owned by the current user. Treat others as missing/Unknown.
    const categoryMap = new Map(
      categories
        .filter((c) => c && (c.userId === undefined || c.userId === userId))
        .map((c) => [c!._id, c!]),
    )

    // Calculate totals by category
    const categoryTotals: Record<string, { name: string; total: number; count: number }> = {}
    let total = 0

    for (const expense of expenses) {
      const amount = expense.amount ?? 0
      total += amount
      const category = expense.categoryId ? categoryMap.get(expense.categoryId) : undefined
      const categoryName = category?.name || 'Unknown'

      if (!categoryTotals[categoryName]) {
        categoryTotals[categoryName] = { name: categoryName, total: 0, count: 0 }
      }
      categoryTotals[categoryName].total += amount
      categoryTotals[categoryName].count += 1
    }

    // Enrich expenses with category names
    const enrichedExpenses = expenses.map((expense) => ({
      ...expense,
      categoryName:
        (expense.categoryId ? categoryMap.get(expense.categoryId)?.name : undefined) || 'Unknown',
    }))

    // Sort by date
    enrichedExpenses.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

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

    validateYearMonth(args.year, args.month)

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
        }),
    )

    return attachments.filter((a) => a.url !== null)
  },
})
