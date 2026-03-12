import { useState, useCallback, useRef, type ChangeEvent } from 'react'
import { useSuspenseQuery, useMutation } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
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
import { parseCurrencyToCents, centsToInputValue, getTodayISO } from '@/lib/format'
import { toast } from 'sonner'
import { expenseFormSchema, MAX_FILE_SIZE, ALLOWED_CONTENT_TYPES } from './schema'
import { DateField } from './date-field'
import { MerchantField } from './merchant-field'
import { CategoryField } from './category-field'
import { AmountField } from './amount-field'
import { AttachmentField } from './attachment-field'

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

export function ExpenseForm({ expense, mode }: ExpenseFormProps) {
  const navigate = useNavigate()

  const { data: categories } = useSuspenseQuery(convexQuery(api.categories.list, {}))
  const { data: merchants } = useSuspenseQuery(convexQuery(api.expenses.getMerchants, {}))

  const [attachmentId, setAttachmentId] = useState<Id<'_storage'> | undefined>(
    expense?.attachmentId,
  )
  const [isUploading, setIsUploading] = useState(false)
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
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      if (!file) return

      if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
        toast.error('Unsupported file type. Use images or PDF.')
        return
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File too large. Maximum ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.`)
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
      setShowDeleteExpense(false)
      deleteExpense.mutate({ id: expense._id })
    }
  }

  const handleRemoveAttachment = () => {
    if (expense && attachmentId && attachmentId === expense.attachmentId) {
      const previousId = attachmentId
      setAttachmentId(undefined)
      removeAttachment.mutate(
        { id: expense._id },
        {
          onError: () =>
            setAttachmentId((current) => (current === undefined ? previousId : current)),
        },
      )
    } else {
      setAttachmentId(undefined)
    }
  }

  const isLoading =
    form.state.isSubmitting ||
    createExpense.isPending ||
    updateExpense.isPending ||
    deleteExpense.isPending ||
    removeAttachment.isPending ||
    isUploading

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      noValidate
      className="max-w-2xl space-y-6"
    >
      <form.Field name="date">
        {(field) => <DateField field={field} isLoading={isLoading} />}
      </form.Field>

      <form.Field name="merchant">
        {(field) => (
          <MerchantField field={field} isLoading={isLoading} merchants={merchants ?? []} />
        )}
      </form.Field>

      <form.Field name="categoryId">
        {(categoryIdField) => (
          <form.Field name="newCategoryName">
            {(newCatField) => (
              <CategoryField
                categoryIdField={categoryIdField}
                newCatField={newCatField}
                isLoading={isLoading}
                categories={categories ?? []}
              />
            )}
          </form.Field>
        )}
      </form.Field>

      <form.Field name="amount">
        {(field) => <AmountField field={field} isLoading={isLoading} />}
      </form.Field>

      <AttachmentField
        attachmentId={attachmentId}
        isPersistedAttachment={attachmentId === expense?.attachmentId}
        isLoading={isLoading}
        isUploading={isUploading}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
        onRemoveAttachment={handleRemoveAttachment}
      />

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

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading}>
          {form.state.isSubmitting
            ? 'Saving...'
            : mode === 'create'
              ? 'Create expense'
              : 'Save changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={() => navigate({ to: '/dashboard' })}
        >
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
