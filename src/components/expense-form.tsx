import { useState, useCallback } from 'react'
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
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
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, parseCurrencyToCents, centsToInputValue, getTodayISO } from '@/lib/format'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

interface ExpenseFormProps {
  expense?: {
    _id: Id<'expenses'>
    date: string
    merchant: string
    amount: number
    categoryId: Id<'categories'>
    attachmentId?: Id<'_storage'>
    comment?: string
  }
  mode: 'create' | 'edit'
}

export function ExpenseFormSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  )
}

function AttachmentPreview({ attachmentId }: { attachmentId: Id<'_storage'> }) {
  const { data: url, isLoading } = useQuery(
    convexQuery(api.storage.getUrl, { storageId: attachmentId })
  )
  const [isImage, setIsImage] = useState(true)

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-md" />
  }

  if (!url) {
    return <p className="text-sm text-muted-foreground">Attachment not available</p>
  }

  return (
    <div className="space-y-2">
      {isImage ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt="Attachment preview"
            className="max-h-48 rounded-md border object-contain"
            onError={() => setIsImage(false)}
          />
        </a>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          📄 View PDF attachment
        </a>
      )}
    </div>
  )
}

export function ExpenseForm({ expense, mode }: ExpenseFormProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  // Fetch data
  const { data: categories } = useSuspenseQuery(convexQuery(api.categories.list, {}))
  const { data: merchants } = useSuspenseQuery(convexQuery(api.expenses.getMerchants, {}))

  // Form state
  const [date, setDate] = useState(expense?.date || getTodayISO())
  const [merchant, setMerchant] = useState(expense?.merchant || '')
  const [amount, setAmount] = useState(expense ? centsToInputValue(expense.amount) : '')
  const [categoryId, setCategoryId] = useState<Id<'categories'> | null>(expense?.categoryId || null)
  const [comment, setComment] = useState(expense?.comment || '')
  const [attachmentId, setAttachmentId] = useState<Id<'_storage'> | undefined>(expense?.attachmentId)
  const [newCategoryName, setNewCategoryName] = useState('')
  
  // UI state
  const [isDateOpen, setIsDateOpen] = useState(false)
  const [isMerchantOpen, setIsMerchantOpen] = useState(false)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showDeleteAttachment, setShowDeleteAttachment] = useState(false)
  const [showDeleteExpense, setShowDeleteExpense] = useState(false)

  // Mutations
  const createExpense = useMutation({
    mutationFn: useConvexMutation(api.expenses.create),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: convexQuery(api.expenses.list, {}).queryKey })
      toast.success('Expense created')
      navigate({ to: '/dashboard' })
    },
    onError: () => {
      toast.error('Error creating expense')
    },
  })

  const updateExpense = useMutation({
    mutationFn: useConvexMutation(api.expenses.update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: convexQuery(api.expenses.list, {}).queryKey })
      toast.success('Expense updated')
      navigate({ to: '/dashboard' })
    },
    onError: () => {
      toast.error('Error updating expense')
    },
  })

  const deleteExpense = useMutation({
    mutationFn: useConvexMutation(api.expenses.remove),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: convexQuery(api.expenses.list, {}).queryKey })
      toast.success('Expense deleted')
      navigate({ to: '/dashboard' })
    },
    onError: () => {
      toast.error('Error deleting expense')
    },
  })

  const createCategory = useMutation({
    mutationFn: useConvexMutation(api.categories.create),
    onSuccess: (newId: Id<'categories'>) => {
      queryClient.invalidateQueries({ queryKey: convexQuery(api.categories.list, {}).queryKey })
      setCategoryId(newId)
      setNewCategoryName('')
      toast.success('Category created')
    },
    onError: () => {
      toast.error('Error creating category')
    },
  })

  const generateUploadUrl = useMutation({
    mutationFn: useConvexMutation(api.storage.generateUploadUrl),
  })

  const removeAttachment = useMutation({
    mutationFn: useConvexMutation(api.expenses.removeAttachment),
    onSuccess: () => {
      setAttachmentId(undefined)
      toast.success('Attachment removed')
    },
    onError: () => {
      toast.error('Error removing attachment')
    },
  })

  // File upload handler
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      toast.error('Unsupported file type. Use images or PDF.')
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum 10MB.')
      return
    }

    setIsUploading(true)
    try {
      const uploadUrl = await generateUploadUrl.mutateAsync({})
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const { storageId } = await response.json()
      setAttachmentId(storageId)
      toast.success('File uploaded')
    } catch {
      toast.error('Error uploading file')
    } finally {
      setIsUploading(false)
    }
  }, [generateUploadUrl])

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!categoryId) {
      toast.error('Select a category')
      return
    }

    const amountCents = parseCurrencyToCents(amount)
    if (amountCents <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    if (!merchant.trim()) {
      toast.error('Enter the merchant')
      return
    }

    const data = {
      date,
      merchant: merchant.trim(),
      amount: amountCents,
      categoryId,
      attachmentId,
      comment: comment.trim() || undefined,
    }

    if (mode === 'create') {
      createExpense.mutate(data)
    } else if (expense) {
      updateExpense.mutate({ id: expense._id, ...data })
    }
  }

  const handleDeleteExpense = () => {
    if (expense) {
      deleteExpense.mutate({ id: expense._id })
    }
  }

  const handleRemoveAttachment = () => {
    if (expense && attachmentId) {
      removeAttachment.mutate({ id: expense._id })
    } else {
      // If not saved yet, just clear the state
      setAttachmentId(undefined)
    }
    setShowDeleteAttachment(false)
  }

  const handleCreateCategory = () => {
    if (newCategoryName.trim()) {
      createCategory.mutate({ name: newCategoryName.trim() })
    }
  }

  const isLoading = createExpense.isPending || updateExpense.isPending || deleteExpense.isPending

  // Find selected category name
  const selectedCategory = categories?.find((c) => c._id === categoryId)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Date */}
      <div className="space-y-2">
        <Label>Date</Label>
        <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
          <PopoverTrigger>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-left font-normal"
            >
              {date ? format(new Date(date), 'PPP', { locale: enUS }) : 'Select date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date ? new Date(date) : undefined}
              onSelect={(d) => {
                if (d) {
                  setDate(d.toISOString().split('T')[0])
                  setIsDateOpen(false)
                }
              }}
              locale={enUS}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Merchant (combobox) */}
      <div className="space-y-2">
        <Label>Merchant</Label>
        <Popover open={isMerchantOpen} onOpenChange={setIsMerchantOpen}>
          <PopoverTrigger>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              className="w-full justify-start text-left font-normal"
            >
              {merchant || 'Select or type...'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search or create..."
                value={merchant}
                onValueChange={setMerchant}
              />
              <CommandList>
                <CommandEmpty>
                  {merchant && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => setIsMerchantOpen(false)}
                    >
                      + Use &quot;{merchant}&quot;
                    </Button>
                  )}
                </CommandEmpty>
                <CommandGroup heading="Recent merchants">
                  {merchants?.map((m) => (
                    <CommandItem
                      key={m}
                      value={m}
                      onSelect={() => {
                        setMerchant(m)
                        setIsMerchantOpen(false)
                      }}
                    >
                      {m}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Category (combobox) */}
      <div className="space-y-2">
        <Label>Category</Label>
        <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
          <PopoverTrigger>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              className="w-full justify-start text-left font-normal"
            >
              {selectedCategory ? (
                <>
                  {selectedCategory.icon && <span className="mr-2">{selectedCategory.icon}</span>}
                  {selectedCategory.name}
                </>
              ) : (
                'Select category...'
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search or create..."
                value={newCategoryName}
                onValueChange={setNewCategoryName}
              />
              <CommandList>
                <CommandEmpty>
                  {newCategoryName && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={handleCreateCategory}
                      disabled={createCategory.isPending}
                    >
                      + Create &quot;{newCategoryName}&quot;
                    </Button>
                  )}
                </CommandEmpty>
                <CommandGroup heading="Categories">
                  {categories?.map((category) => (
                    <CommandItem
                      key={category._id}
                      value={category.name}
                      onSelect={() => {
                        setCategoryId(category._id)
                        setIsCategoryOpen(false)
                        setNewCategoryName('')
                      }}
                    >
                      {category.icon && <span className="mr-2">{category.icon}</span>}
                      {category.name}
                      {category.isPredefined && (
                        <span className="ml-auto text-xs text-muted-foreground">predefined</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {newCategoryName && !categories?.some(c => c.name.toLowerCase() === newCategoryName.toLowerCase()) && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={handleCreateCategory}>
                        + Create &quot;{newCategoryName}&quot;
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">Amount (EUR)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
          <Input
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-8"
            required
          />
        </div>
        {amount && parseCurrencyToCents(amount) > 0 && (
          <p className="text-sm text-muted-foreground">
            {formatCurrency(parseCurrencyToCents(amount))}
          </p>
        )}
      </div>

      {/* Attachment */}
      <div className="space-y-2">
        <Label>Attachment (optional)</Label>
        {attachmentId ? (
          <div className="space-y-3 p-3 border rounded-md">
            <AttachmentPreview attachmentId={attachmentId} />
            <AlertDialog open={showDeleteAttachment} onOpenChange={setShowDeleteAttachment}>
              <AlertDialogTrigger>
                <Button type="button" variant="ghost" size="sm" className="text-destructive">
                  Remove attachment
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove attachment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The attachment will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRemoveAttachment}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Input
            type="file"
            accept={ACCEPTED_FILE_TYPES.join(',')}
            onChange={handleFileChange}
            disabled={isUploading}
          />
        )}
        {isUploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
        <p className="text-xs text-muted-foreground">
          Images or PDF, maximum 10MB
        </p>
      </div>

      {/* Comment */}
      <div className="space-y-2">
        <Label htmlFor="comment">Notes (optional)</Label>
        <Input
          id="comment"
          type="text"
          placeholder="Add a note..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? 'Saving...'
            : mode === 'create'
              ? 'Create expense'
              : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate({ to: '/dashboard' })}>
          Cancel
        </Button>

        {mode === 'edit' && expense && (
          <AlertDialog open={showDeleteExpense} onOpenChange={setShowDeleteExpense}>
            <AlertDialogTrigger>
              <Button type="button" variant="destructive" className="ml-auto">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The expense and any attachment
                  will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteExpense}
                  className="bg-destructive text-destructive-foreground"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </form>
  )
}
