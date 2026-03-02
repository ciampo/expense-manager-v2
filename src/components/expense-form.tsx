import { useState, useCallback, useRef } from 'react'
import { useSuspenseQuery, useQuery, useMutation } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import {
  formatCurrency,
  parseCurrencyToCents,
  centsToInputValue,
  getTodayISO,
  tryParseLocalDate,
  toISODateString,
} from '@/lib/format'
import { expenseDateSchema, expenseMerchantSchema, expenseAmountSchema } from '@/lib/schemas'
import { shouldShowCreateOption } from '@/lib/combobox'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]

const expenseFormSchema = z
  .object({
    date: expenseDateSchema,
    merchant: expenseMerchantSchema,
    amount: z.string().transform(parseCurrencyToCents).pipe(expenseAmountSchema),
    categoryId: z.union([z.string(), z.null()]),
    // categoryNameSchema enforces min(1), which would wrongly fail when
    // an existing category is selected. The cross-field refine handles
    // the "required" case; the max mirrors categoryNameSchema.
    newCategoryName: z.string().max(100, {
      message: 'Category name must be 100 characters or less.',
    }),
    // expenseCommentSchema is .optional() (accepts undefined), which is
    // incompatible with the form's always-string value. Mirror its
    // max-length constraint inline.
    comment: z.string().max(1000, {
      message: 'Comment must be 1000 characters or less.',
    }),
  })
  .refine((data) => data.categoryId !== null || data.newCategoryName.trim().length > 0, {
    message: 'Select or create a category.',
    path: ['categoryId'],
  })

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
    <div className="max-w-2xl space-y-6">
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
    convexQuery(api.storage.getUrl, { storageId: attachmentId }),
  )
  const [isImage, setIsImage] = useState(true)

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-md" />
  }

  if (!url) {
    return <p className="text-muted-foreground text-sm">Attachment not available</p>
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
          className="text-primary inline-flex items-center gap-2 text-sm hover:underline"
        >
          <span aria-hidden="true">📄</span> View PDF attachment
        </a>
      )}
    </div>
  )
}

export function ExpenseForm({ expense, mode }: ExpenseFormProps) {
  const navigate = useNavigate()

  const { data: categories } = useSuspenseQuery(convexQuery(api.categories.list, {}))
  const { data: merchants } = useSuspenseQuery(convexQuery(api.expenses.getMerchants, {}))

  // Attachment state lives outside the form — upload is an independent async flow
  const [attachmentId, setAttachmentId] = useState<Id<'_storage'> | undefined>(
    expense?.attachmentId,
  )

  // UI state (popover/dialog open states are not form data)
  const [isDateOpen, setIsDateOpen] = useState(false)
  const [isMerchantOpen, setIsMerchantOpen] = useState(false)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showDeleteAttachment, setShowDeleteAttachment] = useState(false)
  const [showDeleteExpense, setShowDeleteExpense] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createExpense = useMutation({
    mutationFn: useConvexMutation(api.expenses.create),
    onSuccess: () => {
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
      toast.success('Expense deleted')
      navigate({ to: '/dashboard' })
    },
    onError: () => {
      toast.error('Error deleting expense')
    },
  })

  const { mutateAsync: generateUploadUrlAsync } = useMutation({
    mutationFn: useConvexMutation(api.storage.generateUploadUrl),
  })

  const { mutateAsync: confirmUploadAsync } = useMutation({
    mutationFn: useConvexMutation(api.storage.confirmUpload),
  })

  const removeAttachment = useMutation({
    mutationFn: useConvexMutation(api.expenses.removeAttachment),
    onSuccess: () => {
      toast.success('Attachment removed')
    },
    onError: () => {
      toast.error('Error removing attachment')
    },
  })

  const form = useForm({
    defaultValues: {
      date: expense?.date || getTodayISO(),
      merchant: expense?.merchant || '',
      amount: expense ? centsToInputValue(expense.amount) : '',
      categoryId: (expense?.categoryId ?? null) as string | null,
      newCategoryName: '',
      comment: expense?.comment || '',
    },
    validators: {
      onSubmit: expenseFormSchema,
    },
    onSubmit: async ({ value }) => {
      const amountCents = parseCurrencyToCents(value.amount)

      const data = {
        date: value.date,
        merchant: value.merchant.trim(),
        amount: amountCents,
        ...(value.categoryId
          ? { categoryId: value.categoryId as Id<'categories'> }
          : { newCategoryName: value.newCategoryName.trim() }),
        attachmentId,
        comment: value.comment.trim() || undefined,
      }

      try {
        if (mode === 'create') {
          await createExpense.mutateAsync(data)
        } else if (expense) {
          await updateExpense.mutateAsync({ id: expense._id, ...data })
        }
      } catch {
        // Error toast shown by mutation onError callbacks
      }
    },
  })

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      if (!file) return

      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        toast.error('Unsupported file type. Use images or PDF.')
        return
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error('File too large. Maximum 10MB.')
        return
      }

      setIsUploading(true)
      try {
        const uploadUrl = await generateUploadUrlAsync({})

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        const { storageId } = await response.json()
        await confirmUploadAsync({ storageId })
        setAttachmentId(storageId)
        toast.success('File uploaded')
      } catch {
        toast.error('Error uploading file')
      } finally {
        setIsUploading(false)
      }
    },
    [generateUploadUrlAsync, confirmUploadAsync],
  )

  const handleDeleteExpense = () => {
    if (expense) {
      deleteExpense.mutate({ id: expense._id })
    }
  }

  const handleRemoveAttachment = () => {
    if (expense && attachmentId) {
      const previousId = attachmentId
      setAttachmentId(undefined)
      removeAttachment.mutate({ id: expense._id }, { onError: () => setAttachmentId(previousId) })
    } else {
      setAttachmentId(undefined)
    }
    setShowDeleteAttachment(false)
  }

  const isLoading =
    form.state.isSubmitting ||
    createExpense.isPending ||
    updateExpense.isPending ||
    deleteExpense.isPending

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      noValidate
      className="max-w-2xl space-y-6"
    >
      {/* Date */}
      <form.Field name="date">
        {(field) => {
          const selectedDate = field.state.value ? tryParseLocalDate(field.state.value) : undefined
          const hasErrors = field.state.meta.errors.length > 0
          return (
            <Field data-invalid={hasErrors || undefined}>
              <FieldLabel htmlFor="date-picker">Date</FieldLabel>
              <Popover
                open={isDateOpen && !isLoading}
                onOpenChange={(open) => {
                  setIsDateOpen(open)
                  if (!open) field.handleBlur()
                }}
              >
                <PopoverTrigger
                  render={
                    <Button
                      id="date-picker"
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      disabled={isLoading}
                      aria-invalid={hasErrors}
                      aria-describedby={hasErrors ? 'date-error' : undefined}
                    />
                  }
                >
                  {selectedDate ? format(selectedDate, 'PPP', { locale: enUS }) : 'Select date'}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => {
                      if (d) {
                        field.handleChange(toISODateString(d))
                        setIsDateOpen(false)
                      }
                    }}
                    locale={enUS}
                  />
                </PopoverContent>
              </Popover>
              <FieldError id="date-error" errors={field.state.meta.errors} />
            </Field>
          )
        }}
      </form.Field>

      {/* Merchant */}
      <form.Field name="merchant">
        {(field) => {
          const hasErrors = field.state.meta.errors.length > 0
          return (
            <Field data-invalid={hasErrors || undefined}>
              <FieldLabel htmlFor="merchant-combobox">Merchant</FieldLabel>
              <Popover
                open={isMerchantOpen && !isLoading}
                onOpenChange={(open) => {
                  setIsMerchantOpen(open)
                  if (!open) field.handleBlur()
                }}
              >
                <PopoverTrigger
                  render={
                    <Button
                      id="merchant-combobox"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-describedby={hasErrors ? 'merchant-error' : undefined}
                      aria-invalid={hasErrors}
                      className="w-full justify-start text-left font-normal"
                      disabled={isLoading}
                    />
                  }
                >
                  {field.state.value || 'Select or type...'}
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search or create..."
                      value={field.state.value}
                      onValueChange={(v) => field.handleChange(v)}
                      disabled={isLoading}
                    />
                    <CommandList>
                      <CommandEmpty>No merchants found</CommandEmpty>
                      <CommandGroup heading="Recent merchants">
                        {merchants?.map((m) => (
                          <CommandItem
                            key={m}
                            value={m}
                            onSelect={() => {
                              field.handleChange(m)
                              setIsMerchantOpen(false)
                            }}
                          >
                            {m}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {shouldShowCreateOption(merchants ?? [], field.state.value) && (
                        <>
                          <CommandSeparator />
                          <CommandGroup forceMount>
                            <CommandItem forceMount onSelect={() => setIsMerchantOpen(false)}>
                              + Use &quot;{field.state.value}&quot;
                            </CommandItem>
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <FieldError id="merchant-error" errors={field.state.meta.errors} />
            </Field>
          )
        }}
      </form.Field>

      {/* Category */}
      <form.Field name="categoryId">
        {(categoryIdField) => (
          <form.Field name="newCategoryName">
            {(newCatField) => {
              const hasErrors = categoryIdField.state.meta.errors.length > 0
              const selectedCategory = categories?.find(
                (c) => c._id === categoryIdField.state.value,
              )
              const needsNewCategory =
                !categoryIdField.state.value && !!newCatField.state.value.trim()

              return (
                <Field data-invalid={hasErrors || undefined}>
                  <FieldLabel htmlFor="category-combobox">Category</FieldLabel>
                  <Popover
                    open={isCategoryOpen && !isLoading}
                    onOpenChange={(open) => {
                      setIsCategoryOpen(open)
                      if (!open) categoryIdField.handleBlur()
                    }}
                  >
                    <PopoverTrigger
                      render={
                        <Button
                          id="category-combobox"
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-describedby={hasErrors ? 'category-error' : undefined}
                          aria-invalid={hasErrors}
                          className="w-full justify-start text-left font-normal"
                          disabled={isLoading}
                        />
                      }
                    >
                      {selectedCategory ? (
                        <>
                          {selectedCategory.icon && (
                            <span className="mr-2">{selectedCategory.icon}</span>
                          )}
                          {selectedCategory.name}
                        </>
                      ) : needsNewCategory ? (
                        newCatField.state.value.trim()
                      ) : (
                        'Select category...'
                      )}
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search or create..."
                          value={newCatField.state.value}
                          onValueChange={(v) => newCatField.handleChange(v)}
                          disabled={isLoading}
                        />
                        <CommandList>
                          <CommandEmpty>No categories found</CommandEmpty>
                          <CommandGroup heading="Categories">
                            {categories?.map((category) => (
                              <CommandItem
                                key={category._id}
                                value={category.name}
                                onSelect={() => {
                                  categoryIdField.handleChange(category._id)
                                  newCatField.handleChange('')
                                  setIsCategoryOpen(false)
                                }}
                              >
                                {category.icon && <span className="mr-2">{category.icon}</span>}
                                {category.name}
                                {category.isPredefined && (
                                  <span className="text-muted-foreground ml-auto text-xs">
                                    predefined
                                  </span>
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          {shouldShowCreateOption(
                            (categories ?? []).map((c) => c.name),
                            newCatField.state.value,
                          ) && (
                            <>
                              <CommandSeparator />
                              <CommandGroup forceMount>
                                <CommandItem
                                  forceMount
                                  onSelect={() => {
                                    categoryIdField.handleChange(null)
                                    setIsCategoryOpen(false)
                                  }}
                                >
                                  + Use &quot;{newCatField.state.value}&quot;
                                </CommandItem>
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FieldError id="category-error" errors={categoryIdField.state.meta.errors} />
                </Field>
              )
            }}
          </form.Field>
        )}
      </form.Field>

      {/* Amount */}
      <form.Field name="amount">
        {(field) => {
          const hasErrors = field.state.meta.errors.length > 0
          const parsedAmount = parseCurrencyToCents(field.state.value)
          return (
            <Field data-invalid={hasErrors || undefined}>
              <FieldLabel htmlFor="amount">Amount (EUR)</FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <InputGroupText>€</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  disabled={isLoading}
                  aria-describedby={hasErrors ? 'amount-error' : undefined}
                  aria-invalid={hasErrors}
                />
              </InputGroup>
              {field.state.value && parsedAmount > 0 && (
                <p className="text-muted-foreground text-sm">{formatCurrency(parsedAmount)}</p>
              )}
              <FieldError id="amount-error" errors={field.state.meta.errors} />
            </Field>
          )
        }}
      </form.Field>

      {/* Attachment */}
      <div className="space-y-2">
        <FieldLabel htmlFor="attachment-input">Attachment (optional)</FieldLabel>
        {attachmentId ? (
          <div className="space-y-3 rounded-md border p-3">
            <AttachmentPreview attachmentId={attachmentId} />
            <AlertDialog open={showDeleteAttachment} onOpenChange={setShowDeleteAttachment}>
              <AlertDialogTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={isLoading}
                  />
                }
              >
                Remove attachment
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
            ref={fileInputRef}
            id="attachment-input"
            type="file"
            accept={ACCEPTED_FILE_TYPES.join(',')}
            onChange={handleFileChange}
            disabled={isUploading || isLoading}
          />
        )}
        {isUploading && <p className="text-muted-foreground text-sm">Uploading...</p>}
        <p className="text-muted-foreground text-xs">Images or PDF, maximum 10MB</p>
      </div>

      {/* Comment */}
      <form.Field name="comment">
        {(field) => {
          const hasErrors = field.state.meta.errors.length > 0
          return (
            <Field data-invalid={hasErrors || undefined}>
              <FieldLabel htmlFor="comment">Notes (optional)</FieldLabel>
              <Input
                id="comment"
                type="text"
                placeholder="Add a note..."
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                disabled={isLoading}
                aria-invalid={hasErrors}
                aria-describedby={hasErrors ? 'comment-error' : undefined}
              />
              <FieldError id="comment-error" errors={field.state.meta.errors} />
            </Field>
          )
        }}
      </form.Field>

      {/* Actions */}
      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading}>
          {form.state.isSubmitting
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
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  className="ml-auto"
                  disabled={isLoading}
                />
              }
            >
              Delete
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The expense and any attachment will be permanently
                  deleted.
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
