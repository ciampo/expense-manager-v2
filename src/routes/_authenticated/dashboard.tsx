import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { formatCurrency, formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Suspense, useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Manage your expenses</p>
        </div>
        <Button render={<Link to="/expenses/new" />}>
          + New expense
        </Button>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <ExpenseTable />
      </Suspense>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Attachment</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20 ml-auto" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-20 ml-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ExpenseTable() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: expenses } = useSuspenseQuery(convexQuery(api.expenses.list, {}))
  const { data: categories } = useSuspenseQuery(convexQuery(api.categories.list, {}))
  
  const [deletingId, setDeletingId] = useState<Id<'expenses'> | null>(null)

  const expensesQueryKey = convexQuery(api.expenses.list, {}).queryKey

  const deleteExpense = useMutation({
    mutationFn: useConvexMutation(api.expenses.remove),
    onMutate: async (args: { id: Id<'expenses'> }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: expensesQueryKey })
      
      // Snapshot current value
      const previousExpenses = queryClient.getQueryData(expensesQueryKey)
      
      // Optimistically remove from cache
      queryClient.setQueryData(
        expensesQueryKey,
        (old: typeof expenses) => old?.filter((e) => e._id !== args.id)
      )
      
      return { previousExpenses }
    },
    onError: (_err, _args, context) => {
      // Rollback on error
      if (context?.previousExpenses) {
        queryClient.setQueryData(
          expensesQueryKey,
          context.previousExpenses
        )
      }
      toast.error('Error deleting expense')
    },
    onSuccess: () => {
      toast.success('Expense deleted')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: expensesQueryKey })
    },
  })

  const handleDelete = (id: Id<'expenses'>) => {
    setDeletingId(null)
    deleteExpense.mutate({ id })
  }

  // Create a map of category IDs to names
  const categoryMap = new Map(categories?.map((c) => [c._id, c.name]) || [])

  if (!expenses || expenses.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground mb-4">
          You haven&apos;t recorded any expenses yet
        </p>
        <Button render={<Link to="/expenses/new" />}>
          Add your first expense
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Attachment</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow
              key={expense._id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() =>
                navigate({
                  to: '/expenses/$expenseId',
                  params: { expenseId: expense._id },
                })
              }
            >
              <TableCell>
                <Link
                  to="/expenses/$expenseId"
                  params={{ expenseId: expense._id }}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  {formatDate(expense.date)}
                </Link>
              </TableCell>
              <TableCell>{expense.merchant}</TableCell>
              <TableCell>
                {categoryMap.get(expense.categoryId) || 'N/A'}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(expense.amount)}
              </TableCell>
              <TableCell>
                {expense.attachmentId ? (
                  <>
                    <span aria-hidden="true">📎</span>
                    <span className="sr-only">Has attachment</span>
                  </>
                ) : (
                  '-'
                )}
              </TableCell>
              <TableCell className="text-right">
                <AlertDialog
                  open={deletingId === expense._id}
                  onOpenChange={(open) =>
                    setDeletingId(open ? expense._id : null)
                  }
                >
                  <AlertDialogTrigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The expense and any
                        attachment will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(expense._id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
