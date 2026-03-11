import { createFileRoute } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { ExpenseForm, ExpenseFormSkeleton } from '@/components/expense-form'
import { RouteErrorComponent } from '@/components/route-error'
import { Suspense } from 'react'

export const Route = createFileRoute('/_authenticated/expenses/new')({
  component: NewExpensePage,
  errorComponent: RouteErrorComponent,
  head: () => ({
    meta: [{ title: 'New Expense — Expense Manager' }],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(convexQuery(api.categories.list, {})),
      context.queryClient.ensureQueryData(convexQuery(api.expenses.getMerchants, {})),
    ])
  },
})

function NewExpensePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">New expense</h1>
        <p className="text-muted-foreground">Add a new expense</p>
      </div>

      <Suspense fallback={<ExpenseFormSkeleton />}>
        <ExpenseForm mode="create" />
      </Suspense>
    </div>
  )
}
