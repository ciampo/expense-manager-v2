import { createFileRoute, notFound, type ErrorComponentProps } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { ExpenseForm, ExpenseFormSkeleton } from '@/components/expense-form'
import { RouteErrorComponent } from '@/components/route-error'
import { RouteNotFoundComponent } from '@/components/route-not-found'
import { Suspense } from 'react'

export const Route = createFileRoute('/_authenticated/expenses/$expenseId')({
  component: EditExpensePage,
  errorComponent: ExpenseIdErrorComponent,
  head: () => ({
    meta: [{ title: 'Edit Expense — Expense Manager' }],
  }),
})

/**
 * Convex's `v.id()` validator rejects invalid ID formats before the query
 * handler runs. Map those errors to the 404 UI so users see "page not found"
 * instead of a generic error for bogus URLs like `/expenses/garbage`.
 */
function ExpenseIdErrorComponent(props: ErrorComponentProps): React.ReactNode {
  if (/not a valid ID for table/i.test(props.error.message)) {
    return <RouteNotFoundComponent />
  }
  return <RouteErrorComponent {...props} />
}

function EditExpensePage() {
  const { expenseId } = Route.useParams()

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
    throw notFound()
  }

  return <ExpenseForm expense={expense} mode="edit" />
}
