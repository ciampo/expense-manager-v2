import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { ExpenseForm, ExpenseFormSkeleton } from '@/components/expense-form'
import { Suspense } from 'react'

export const Route = createFileRoute('/_authenticated/expenses/$expenseId')({
  component: EditExpensePage,
})

function EditExpensePage() {
  const { expenseId } = Route.useParams()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Modifica spesa</h1>
        <p className="text-muted-foreground">Modifica i dettagli della spesa</p>
      </div>

      <Suspense fallback={<ExpenseFormSkeleton />}>
        <EditExpenseForm expenseId={expenseId as Id<'expenses'>} />
      </Suspense>
    </div>
  )
}

function EditExpenseForm({ expenseId }: { expenseId: Id<'expenses'> }) {
  const { data: expense } = useSuspenseQuery(
    convexQuery(api.expenses.get, { id: expenseId })
  )

  if (!expense) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Spesa non trovata</p>
      </div>
    )
  }

  return <ExpenseForm expense={expense} mode="edit" />
}
