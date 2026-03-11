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
    meta: [{ title: 'Edit Expense — Expense Manager' }],
  }),
  loader: ({ context, params }) => {
    if (!CONVEX_ID_RE.test(params.expenseId)) return
    return Promise.all([
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit expense</h1>
        <p className="text-muted-foreground">Edit the expense details</p>
      </div>

      <Suspense fallback={<ExpenseFormSkeleton />}>
        <EditExpenseForm expenseId={expenseId as Id<'expenses'>} />
      </Suspense>
    </div>
  )
}

function EditExpenseForm({ expenseId }: { expenseId: Id<'expenses'> }) {
  const { data: expense } = useSuspenseQuery(convexQuery(api.expenses.get, { id: expenseId }))

  if (!expense) {
    return <RouteNotFoundComponent />
  }

  return <ExpenseForm expense={expense} mode="edit" />
}
