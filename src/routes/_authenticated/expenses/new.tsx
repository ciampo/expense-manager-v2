import { createFileRoute } from '@tanstack/react-router'
import { ExpenseForm, ExpenseFormSkeleton } from '@/components/expense-form'
import { RouteErrorComponent } from '@/components/route-error'
import { Suspense } from 'react'

export const Route = createFileRoute('/_authenticated/expenses/new')({
  component: NewExpensePage,
  errorComponent: RouteErrorComponent,
  head: () => ({
    meta: [{ title: 'New Expense — Expense Manager' }],
  }),
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
