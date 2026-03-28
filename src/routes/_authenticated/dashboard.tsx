import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Suspense, useMemo, useState, useTransition } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { RouteErrorComponent } from '@/components/route-error'

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const PAGINATION_THRESHOLD = Math.min(...PAGE_SIZE_OPTIONS)
const DEFAULT_PAGE_SIZE = 25

type DraftFilter = 'complete' | 'drafts' | 'all'
const DRAFT_FILTERS: ReadonlySet<string> = new Set<DraftFilter>(['complete', 'drafts', 'all'])

function draftFilterToArg(filter: DraftFilter): boolean | undefined {
  if (filter === 'complete') return false
  if (filter === 'drafts') return true
  return undefined
}

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
  errorComponent: RouteErrorComponent,
  head: () => ({
    meta: [{ title: 'Dashboard — Expense Manager' }],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.expenses.list, {
          cursor: null,
          limit: DEFAULT_PAGE_SIZE,
          isDraft: false,
        }),
      ),
      context.queryClient.ensureQueryData(convexQuery(api.categories.list, {})),
      context.queryClient.ensureQueryData(convexQuery(api.expenses.draftCount, {})),
    ])
  },
})

function DashboardPage() {
  const [draftFilter, setDraftFilter] = useState<DraftFilter>('complete')
  const [, startFilterTransition] = useTransition()

  const handleFilterChange = (value: DraftFilter) => {
    startFilterTransition(() => setDraftFilter(value))
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Manage your expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled title="Coming soon">
            Upload receipts
          </Button>
          <Button render={<Link to="/expenses/new" />}>+ New expense</Button>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="mb-4 h-9 w-64" />}>
        <DraftFilterTabs value={draftFilter} onValueChange={handleFilterChange} />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <ExpenseTable draftFilter={draftFilter} />
      </Suspense>
    </div>
  )
}

function DraftFilterTabs({
  value,
  onValueChange,
}: {
  value: DraftFilter
  onValueChange: (value: DraftFilter) => void
}) {
  const { data: draftCount } = useSuspenseQuery(convexQuery(api.expenses.draftCount, {}))

  return (
    <Tabs
      value={value}
      onValueChange={(v) => {
        if (DRAFT_FILTERS.has(v as string)) onValueChange(v as DraftFilter)
      }}
      className="mb-4"
    >
      <TabsList aria-label="Filter expenses by status">
        <TabsTrigger value="complete">Complete</TabsTrigger>
        <TabsTrigger value="drafts">
          Drafts{' '}
          {draftCount > 0 && (
            <Badge variant="secondary" className="ml-1 min-w-5 justify-center px-1">
              {draftCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="all">All</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

function TableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table aria-label="Expenses">
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
                <Skeleton className="ml-auto h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-8 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ExpenseTable({ draftFilter }: { draftFilter: DraftFilter }) {
  const queryClient = useQueryClient()
  const { data: categories } = useSuspenseQuery(convexQuery(api.categories.list, {}))

  const [deletingId, setDeletingId] = useState<Id<'expenses'> | null>(null)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  // Cursor stack: index 0 is always null (first page). Navigating forward
  // pushes the server's continueCursor; navigating backward pops.
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [isPending, startTransition] = useTransition()

  const isDraftArg = draftFilterToArg(draftFilter)

  // Reset pagination when the draft filter changes
  const [prevFilter, setPrevFilter] = useState(draftFilter)
  if (draftFilter !== prevFilter) {
    setPrevFilter(draftFilter)
    setCursors([null])
  }

  const currentCursor = cursors[cursors.length - 1]
  const pageNumber = cursors.length

  const queryArgs = { cursor: currentCursor, limit: pageSize, isDraft: isDraftArg }
  const { data: expensesPage } = useSuspenseQuery(convexQuery(api.expenses.list, queryArgs))
  const expenses = expensesPage?.expenses ?? []

  // Convex's .paginate() returns isDone: false for a full page even when
  // no more items exist.  Prefetch the next cursor (1 item) so we can
  // disable "Next" when the next page is actually empty.
  const nextCursor = expensesPage?.continueCursor
  const shouldPeekNext = !expensesPage?.isDone && !!nextCursor
  const {
    data: nextPagePeek,
    isLoading: isNextPagePeekLoading,
    isError: isNextPagePeekError,
  } = useQuery({
    ...convexQuery(api.expenses.list, { cursor: nextCursor, limit: 1, isDraft: isDraftArg }),
    enabled: shouldPeekNext,
  })
  const canGoNext = (() => {
    if (!shouldPeekNext) {
      return !expensesPage?.isDone
    }
    if (isNextPagePeekLoading) {
      return false
    }
    if (isNextPagePeekError) {
      return !expensesPage?.isDone
    }
    return !!nextPagePeek && nextPagePeek.expenses.length > 0
  })()
  const canGoPrevious = cursors.length > 1

  const expensesQueryKey = convexQuery(api.expenses.list, queryArgs).queryKey

  const deleteExpense = useMutation({
    mutationFn: useConvexMutation(api.expenses.remove),
    onMutate: async (args: { id: Id<'expenses'> }) => {
      await queryClient.cancelQueries({ queryKey: expensesQueryKey })

      const previousExpenses = queryClient.getQueryData(expensesQueryKey)

      queryClient.setQueryData(expensesQueryKey, (old: typeof expensesPage) =>
        old ? { ...old, expenses: old.expenses.filter((e) => e._id !== args.id) } : old,
      )

      // Navigate to the previous page when this deletion empties the
      // current one. Checking the cache after the optimistic update
      // avoids a render-phase or effect-based setState.
      const updated = queryClient.getQueryData(expensesQueryKey) as typeof expensesPage | undefined
      const previousCursors =
        updated?.expenses.length === 0 && cursors.length > 1 ? [...cursors] : null
      let previousPageEntry: { queryKey: readonly unknown[]; data: unknown } | null = null
      if (previousCursors) {
        // Mark the previous page as the last page so "Next" is
        // disabled until the post-mutation refetch corrects the cache.
        const prevCursor = cursors[cursors.length - 2]
        const prevQueryKey = convexQuery(api.expenses.list, {
          cursor: prevCursor,
          limit: pageSize,
          isDraft: isDraftArg,
        }).queryKey
        // Cancel any in-flight fetches / reactive subscription pushes
        // for the previous page so they don't overwrite our optimistic
        // isDone before the server-side mutation commits.
        await queryClient.cancelQueries({ queryKey: prevQueryKey })
        previousPageEntry = {
          queryKey: prevQueryKey,
          data: queryClient.getQueryData(prevQueryKey),
        }
        queryClient.setQueryData(prevQueryKey, (old: typeof expensesPage) =>
          old ? { ...old, isDone: true } : old,
        )

        setCursors((prev) => prev.slice(0, -1))
      }

      return { previousExpenses, previousCursors, previousPageEntry }
    },
    onError: (_err, _args, context) => {
      if (context?.previousExpenses) {
        queryClient.setQueryData(expensesQueryKey, context.previousExpenses)
      }
      if (context?.previousPageEntry) {
        queryClient.setQueryData(context.previousPageEntry.queryKey, context.previousPageEntry.data)
      }
      if (context?.previousCursors) {
        setCursors(context.previousCursors)
      }
      toast.error('Error deleting expense')
    },
    onSuccess: () => {
      toast.success('Expense deleted')
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: convexQuery(api.expenses.list, {}).queryKey,
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: convexQuery(api.expenses.draftCount, {}).queryKey,
        }),
      ])
    },
  })

  const handleDelete = (id: Id<'expenses'>) => {
    setDeletingId(null)
    deleteExpense.mutate({ id })
  }

  const categoryMap = useMemo(
    () => new Map(categories?.map((c) => [c._id, c.name]) || []),
    [categories],
  )

  const emptyMessage =
    draftFilter === 'drafts'
      ? 'No draft expenses'
      : draftFilter === 'complete'
        ? "You haven't recorded any expenses yet"
        : 'No expenses found'

  if (expenses.length === 0 && !canGoPrevious) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground mb-4">{emptyMessage}</p>
        {draftFilter !== 'drafts' && (
          <Button render={<Link to="/expenses/new" />}>Add your first expense</Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-md border transition-opacity"
        style={{ opacity: isPending ? 0.6 : 1 }}
      >
        <Table aria-label="Expenses">
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
              <TableRow key={expense._id}>
                <TableCell
                  className={expense.isDraft && !expense.date ? 'text-muted-foreground' : ''}
                >
                  {expense.date ? formatDate(expense.date) : '—'}
                </TableCell>
                <TableCell>
                  <span
                    className={expense.isDraft && !expense.merchant ? 'text-muted-foreground' : ''}
                  >
                    {expense.merchant ?? '—'}
                  </span>
                  {expense.isDraft && (
                    <Badge variant="muted" className="ml-2">
                      Draft
                    </Badge>
                  )}
                </TableCell>
                <TableCell
                  className={expense.isDraft && !expense.categoryId ? 'text-muted-foreground' : ''}
                >
                  {expense.categoryId ? categoryMap.get(expense.categoryId) || 'N/A' : '—'}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-medium',
                    expense.isDraft && expense.amount == null && 'text-muted-foreground',
                  )}
                >
                  {expense.amount != null ? formatCurrency(expense.amount) : '—'}
                </TableCell>
                <TableCell>
                  {expense.attachmentId ? (
                    <AttachmentHoverCard storageId={expense.attachmentId} />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={
                        expense.isDraft
                          ? `Complete ${expense.merchant ?? 'draft'} expense`
                          : `Edit ${expense.merchant ?? 'draft'} expense`
                      }
                      render={
                        <Link to="/expenses/$expenseId" params={{ expenseId: expense._id }} />
                      }
                    >
                      {expense.isDraft ? 'Complete' : 'Edit'}
                    </Button>
                    <AlertDialog
                      open={deletingId === expense._id}
                      onOpenChange={(open) => setDeletingId(open ? expense._id : null)}
                    >
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            aria-label={`Delete ${expense.merchant ?? 'draft'} expense`}
                          />
                        }
                      >
                        Delete
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. The expense and any attachment will be
                            permanently deleted.
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {(expenses.length >= PAGINATION_THRESHOLD || canGoPrevious) && (
        <nav aria-label="Table pagination" className="flex items-center justify-between">
          <Field orientation="horizontal">
            <FieldLabel htmlFor="page-size" className="text-muted-foreground font-normal">
              Rows per page
            </FieldLabel>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                startTransition(() => {
                  setPageSize(Number(value))
                  setCursors([null])
                })
              }}
            >
              <SelectTrigger id="page-size" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm" aria-live="polite">
              Page {pageNumber}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => startTransition(() => setCursors((prev) => prev.slice(0, -1)))}
                disabled={!canGoPrevious}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = expensesPage?.continueCursor
                  if (next) {
                    startTransition(() => setCursors((prev) => [...prev, next]))
                  }
                }}
                disabled={!canGoNext}
              >
                Next
              </Button>
            </div>
          </div>
        </nav>
      )}
    </div>
  )
}

function AttachmentHoverCard({ storageId }: { storageId: Id<'_storage'> }) {
  const [isOpen, setIsOpen] = useState(false)
  const { data: url, isLoading } = useQuery({
    ...convexQuery(api.storage.getUrl, { storageId }),
    enabled: isOpen,
    // storage.getUrl returns a temporary signed URL — override Convex's
    // default staleTime (Infinity) so cached URLs are refreshed before
    // they expire.
    staleTime: 5 * 60 * 1000,
  })

  return (
    <HoverCard open={isOpen} onOpenChange={setIsOpen}>
      <HoverCardTrigger
        delay={200}
        closeDelay={150}
        render={<button type="button" className="cursor-default border-0 bg-transparent p-0" />}
      >
        <span aria-hidden="true">📎</span>
        <span className="sr-only">Has attachment</span>
      </HoverCardTrigger>
      {isOpen && (
        <HoverCardContent className="w-auto max-w-[220px] p-2" side="top" sideOffset={8}>
          <AttachmentPreviewContent url={url} isLoading={isLoading} />
        </HoverCardContent>
      )}
    </HoverCard>
  )
}

function AttachmentPreviewContent({
  url,
  isLoading,
}: {
  url: string | null | undefined
  isLoading: boolean
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (isLoading) {
    return <Skeleton className="h-[150px] w-[200px] rounded-md" />
  }

  if (!url) {
    return <p className="text-muted-foreground text-xs">Attachment not available</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {url !== failedUrl ? (
        <img
          src={url}
          alt="Attachment preview"
          className="max-h-[200px] max-w-[200px] rounded-md object-contain"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div className="flex items-center gap-2 py-2">
          <span aria-hidden="true">📄</span>
          <span className="text-sm">File attachment</span>
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary text-xs hover:underline"
      >
        View full →
      </a>
    </div>
  )
}
