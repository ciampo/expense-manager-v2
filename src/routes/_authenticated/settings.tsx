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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { type FormEvent, Suspense, useCallback, useRef, useState } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { RouteErrorComponent } from '@/components/route-error'
import { API_KEY_NAME_MAX_LENGTH } from '@/lib/schemas'

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
      context.queryClient.ensureQueryData(convexQuery(api.apiKeys.list, {})),
    ])
  },
})

function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your categories, merchants, and API keys</p>
      </div>

      <div className="space-y-8">
        <Suspense fallback={<SectionSkeleton title="Categories" />}>
          <CategoriesSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton title="Merchants" />}>
          <MerchantsSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton title="API Keys" />}>
          <ApiKeysSection />
        </Suspense>
      </div>
    </div>
  )
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
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
        <CardTitle>
          <h2>Categories</h2>
        </CardTitle>
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
  onRename: (newName: string, newIcon: string | null) => void
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
    setOpen(false)
    onRename(trimmed, icon.trim() || null)
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
        <CardTitle>
          <h2>Merchants</h2>
        </CardTitle>
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
    setOpen(false)
    onRename(trimmed)
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

// ── API Keys ─────────────────────────────────────────────────────────────

function ApiKeysSection() {
  const queryClient = useQueryClient()
  const { data: keys } = useSuspenseQuery(convexQuery(api.apiKeys.list, {}))
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)

  const createKey = useMutation({
    mutationFn: useConvexMutation(api.apiKeys.create),
    onSuccess: (data: { rawKey: string }) => {
      setNewKeyValue(data.rawKey)
      toast.success('API key created')
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.apiKeys.list, {}).queryKey,
      })
    },
    onError: (err) => toast.error(err.message || 'Failed to create API key'),
  })

  const revokeKey = useMutation({
    mutationFn: useConvexMutation(api.apiKeys.revoke),
    onSuccess: () => {
      toast.success('API key revoked')
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.apiKeys.list, {}).queryKey,
      })
    },
    onError: (err) => toast.error(err.message || 'Failed to revoke API key'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>API Keys</h2>
        </CardTitle>
        <CardDescription>
          Create API keys for external services to submit draft expenses via the REST API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <CreateApiKeyForm
          onSubmit={(name) => createKey.mutate({ name })}
          isPending={createKey.isPending}
        />

        {newKeyValue && (
          <NewKeyDisplay rawKey={newKeyValue} onDismiss={() => setNewKeyValue(null)} />
        )}

        {keys.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No API keys yet. Create one to get started.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table aria-label="API Keys">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k._id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell>
                      <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{k.prefix}...</code>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <RevokeKeyDialog
                        keyName={k.name}
                        onConfirm={() => revokeKey.mutate({ id: k._id })}
                      />
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

function CreateApiKeyForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (name: string) => void
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="api-key-name">Key name</Label>
        <Input
          ref={inputRef}
          id="api-key-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. iOS Shortcuts"
          maxLength={API_KEY_NAME_MAX_LENGTH}
          required
          disabled={isPending}
        />
      </div>
      <Button type="submit" disabled={isPending || !name.trim()}>
        {isPending ? 'Generating…' : 'Generate'}
      </Button>
    </form>
  )
}

function NewKeyDisplay({ rawKey, onDismiss }: { rawKey: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(rawKey)
    setCopied(true)
    toast.success('API key copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }, [rawKey])

  return (
    <div className="bg-muted rounded-lg border p-4" role="alert">
      <p className="mb-2 text-sm font-medium">Copy this key now. It won&apos;t be shown again.</p>
      <div className="flex items-center gap-2">
        <code className="bg-background flex-1 overflow-auto rounded border px-3 py-2 text-xs break-all">
          {rawKey}
        </code>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}

function RevokeKeyDialog({ keyName, onConfirm }: { keyName: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false)

  const handleConfirm = () => {
    setOpen(false)
    onConfirm()
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Revoke ${keyName}`}
          />
        }
      >
        Revoke
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
          <AlertDialogDescription>
            The API key &ldquo;{keyName}&rdquo; will be permanently revoked. Any services using this
            key will lose access immediately. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Revoke
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
  const [open, setOpen] = useState(false)

  const handleConfirm = () => {
    setOpen(false)
    onConfirm()
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
