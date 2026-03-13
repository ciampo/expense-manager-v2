import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { api } from '../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { type FormEvent, Suspense, useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { RouteErrorComponent } from '@/components/route-error'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
  errorComponent: RouteErrorComponent,
  head: () => ({
    meta: [{ title: 'Settings — Expense Manager' }],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(convexQuery(api.categories.listWithCounts, {})),
      context.queryClient.ensureQueryData(convexQuery(api.merchants.listWithCounts, {})),
    ])
  },
})

function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your categories and merchants</p>
      </div>

      <div className="space-y-8">
        <Suspense fallback={<SectionSkeleton title="Categories" />}>
          <CategoriesSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton title="Merchants" />}>
          <MerchantsSection />
        </Suspense>
      </div>
    </div>
  )
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          <Skeleton className="h-4 w-48" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  )
}

// ── Categories ──────────────────────────────────────────────────────────

function CategoriesSection() {
  const queryClient = useQueryClient()
  const { data: categories } = useSuspenseQuery(convexQuery(api.categories.listWithCounts, {}))

  const renameCategory = useMutation({
    mutationFn: useConvexMutation(api.categories.rename),
    onSuccess: () => {
      toast.success('Category renamed')
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.categories.listWithCounts, {}).queryKey,
      })
    },
    onError: (err) => toast.error(err.message || 'Failed to rename category'),
  })

  const deleteCategory = useMutation({
    mutationFn: useConvexMutation(api.categories.remove),
    onSuccess: () => {
      toast.success('Category deleted')
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.categories.listWithCounts, {}).queryKey,
      })
    },
    onError: (err) => toast.error(err.message || 'Failed to delete category'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
        <CardDescription>
          Manage expense categories. Predefined categories cannot be modified.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No categories found.</p>
        ) : (
          <div className="rounded-md border">
            <Table aria-label="Categories">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat._id}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {cat.icon && <span aria-hidden="true">{cat.icon}</span>}
                        <span>{cat.name}</span>
                        {cat.isPredefined && (
                          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                            Predefined
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{cat.expenseCount}</TableCell>
                    <TableCell className="text-right">
                      {!cat.isPredefined && (
                        <div className="flex items-center justify-end gap-1">
                          <RenameCategoryDialog
                            categoryId={cat._id}
                            currentName={cat.name}
                            currentIcon={cat.icon}
                            onRename={(newName, newIcon) =>
                              renameCategory.mutate({
                                id: cat._id,
                                newName,
                                newIcon,
                              })
                            }
                          />
                          {cat.expenseCount === 0 ? (
                            <DeleteConfirmDialog
                              label={cat.name}
                              entityType="category"
                              onConfirm={() => deleteCategory.mutate({ id: cat._id })}
                            />
                          ) : (
                            <Button variant="ghost" size="sm" disabled>
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RenameCategoryDialog({
  categoryId,
  currentName,
  currentIcon,
  onRename,
}: {
  categoryId: Id<'categories'>
  currentName: string
  currentIcon?: string
  onRename: (newName: string, newIcon?: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [icon, setIcon] = useState(currentIcon ?? '')

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setName(currentName)
      setIcon(currentIcon ?? '')
    }
    setOpen(next)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onRename(trimmed, icon.trim() || undefined)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" aria-label={`Rename ${currentName}`} />}
      >
        Rename
      </DialogTrigger>
      <DialogContent aria-labelledby={`rename-cat-${categoryId}`}>
        <DialogHeader>
          <DialogTitle id={`rename-cat-${categoryId}`}>Rename category</DialogTitle>
          <DialogDescription>Update the name or icon for this category.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`cat-name-${categoryId}`}>Name</Label>
            <Input
              id={`cat-name-${categoryId}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`cat-icon-${categoryId}`}>Icon (optional)</Label>
            <Input
              id={`cat-icon-${categoryId}`}
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="e.g. 🍕"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Merchants ───────────────────────────────────────────────────────────

function MerchantsSection() {
  const queryClient = useQueryClient()
  const { data: merchants } = useSuspenseQuery(convexQuery(api.merchants.listWithCounts, {}))

  const renameMerchant = useMutation({
    mutationFn: useConvexMutation(api.merchants.rename),
    onSuccess: () => {
      toast.success('Merchant renamed')
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.merchants.listWithCounts, {}).queryKey,
      })
    },
    onError: (err) => toast.error(err.message || 'Failed to rename merchant'),
  })

  const deleteMerchant = useMutation({
    mutationFn: useConvexMutation(api.merchants.remove),
    onSuccess: () => {
      toast.success('Merchant deleted')
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.merchants.listWithCounts, {}).queryKey,
      })
    },
    onError: (err) => toast.error(err.message || 'Failed to delete merchant'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Merchants</CardTitle>
        <CardDescription>
          Manage merchants used in your expenses. Renaming updates all linked expenses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {merchants.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No merchants found.</p>
        ) : (
          <div className="rounded-md border">
            <Table aria-label="Merchants">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchants.map((m) => (
                  <TableRow key={m._id}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.expenseCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <RenameMerchantDialog
                          merchantId={m._id}
                          currentName={m.name}
                          onRename={(newName) => renameMerchant.mutate({ id: m._id, newName })}
                        />
                        {m.expenseCount === 0 ? (
                          <DeleteConfirmDialog
                            label={m.name}
                            entityType="merchant"
                            onConfirm={() => deleteMerchant.mutate({ id: m._id })}
                          />
                        ) : (
                          <Button variant="ghost" size="sm" disabled>
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RenameMerchantDialog({
  merchantId,
  currentName,
  onRename,
}: {
  merchantId: Id<'merchants'>
  currentName: string
  onRename: (newName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)

  const handleOpenChange = (next: boolean) => {
    if (next) setName(currentName)
    setOpen(next)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onRename(trimmed)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" aria-label={`Rename ${currentName}`} />}
      >
        Rename
      </DialogTrigger>
      <DialogContent aria-labelledby={`rename-m-${merchantId}`}>
        <DialogHeader>
          <DialogTitle id={`rename-m-${merchantId}`}>Rename merchant</DialogTitle>
          <DialogDescription>
            This will also update the merchant name on all linked expenses.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`m-name-${merchantId}`}>Name</Label>
            <Input
              id={`m-name-${merchantId}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Shared ──────────────────────────────────────────────────────────────

function DeleteConfirmDialog({
  label,
  entityType,
  onConfirm,
}: {
  label: string
  entityType: 'category' | 'merchant'
  onConfirm: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Delete ${label}`}
          />
        }
      >
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {entityType}?</AlertDialogTitle>
          <AlertDialogDescription>
            The {entityType} &ldquo;{label}&rdquo; will be permanently deleted. This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogPrimitive.Close
            render={
              <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" />
            }
            onClick={onConfirm}
          >
            Delete
          </AlertDialogPrimitive.Close>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
