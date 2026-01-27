import { createFileRoute } from '@tanstack/react-router'
import { ExpenseForm, ExpenseFormSkeleton } from '@/components/expense-form'
import { Suspense } from 'react'

export const Route = createFileRoute('/_authenticated/expenses/new')({
  component: NewExpensePage,
})

function NewExpensePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Nuova spesa</h1>
        <p className="text-muted-foreground">Aggiungi una nuova spesa</p>
      </div>

      <Suspense fallback={<ExpenseFormSkeleton />}>
        <ExpenseForm mode="create" />
      </Suspense>
    </div>
  )
}
