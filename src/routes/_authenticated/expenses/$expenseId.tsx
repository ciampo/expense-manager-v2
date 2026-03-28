import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { ExpenseForm, ExpenseFormSkeleton } from '@/components/expense-form'
import { RouteErrorComponent } from '@/components/route-error'
import { RouteNotFoundComponent } from '@/components/route-not-found'
import { Suspense } from 'react'

// Convex document IDs are 32-character URL-safe base64 strings.
// Reject obviously invalid formats early so the user sees a 404
// instead of a generic Convex server error.
const CONVEX_ID_RE = /^[A-Za-z0-9_-]{32}$/

export const Route = createFileRoute('/_authenticated/expenses/$expenseId')({
  component: EditExpensePage,
  errorComponent: RouteErrorComponent,
  head: () => ({
    meta: [{ title: 'Expense — Expense Manager' }],
  }),
  loader: async ({ context, params }) => {
    if (!CONVEX_ID_RE.test(params.expenseId)) return
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.expenses.get, { id: params.expenseId as Id<'expenses'> }),
      ),
      context.queryClient.ensureQueryData(convexQuery(api.categories.list, {})),
      context.queryClient.ensureQueryData(convexQuery(api.expenses.getMerchants, {})),
    ])
  },
})

function EditExpensePage() {
  const { expenseId } = Route.useParams()

  if (!CONVEX_ID_RE.test(expenseId)) {
    return <RouteNotFoundComponent />
  }

  return (
    <Suspense fallback={<EditExpensePageSkeleton />}>
      <EditExpenseContent expenseId={expenseId as Id<'expenses'>} />
    </Suspense>
  )
}

function EditExpensePageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Loading...</h1>
      </div>
      <ExpenseFormSkeleton />
    </div>
  )
}

function EditExpenseContent({ expenseId }: { expenseId: Id<'expenses'> }) {
  const { data: expense } = useSuspenseQuery(convexQuery(api.expenses.get, { id: expenseId }))

  if (!expense) {
    return <RouteNotFoundComponent />
  }

  const isDraft = expense.isDraft === true

  if (!isDraft && (!expense.date || !expense.merchant || !expense.amount || !expense.categoryId)) {
    return <RouteNotFoundComponent />
  }

  const mode = isDraft ? 'complete-draft' : 'edit'
  const title = isDraft ? 'Complete draft' : 'Edit expense'
  const subtitle = isDraft
    ? 'Fill in the missing details to complete this expense'
    : 'Edit the expense details'

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      <ExpenseForm
        expense={{
          _id: expense._id,
          date: expense.date,
          merchant: expense.merchant,
          amount: expense.amount,
          categoryId: expense.categoryId,
          attachmentId: expense.attachmentId,
          comment: expense.comment,
        }}
        mode={mode}
      />
    </div>
  )
}
