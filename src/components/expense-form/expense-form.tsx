import { useState, useCallback, useRef, useEffect, type ChangeEvent } from 'react'
import { useSuspenseQuery, useMutation } from '@tanstack/react-query'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useForm, useStore } from '@tanstack/react-form'
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
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog'
import {
  expenseFormSchema,
  draftExpenseFormSchema,
  MAX_FILE_SIZE,
  ALLOWED_CONTENT_TYPES,
} from './schema'
import { DateField } from './date-field'
import { MerchantField } from './merchant-field'
import { CategoryField } from './category-field'
import { AmountField } from './amount-field'
import { AttachmentField } from './attachment-field'

interface ExpenseFormProps {
  expense?: {
    _id: Id<'expenses'>
    date?: string
    merchant?: string
    amount?: number
    categoryId?: Id<'categories'>
    attachmentId?: Id<'_storage'>
    comment?: string
  }
  mode: 'create' | 'edit' | 'complete-draft'
}

export function ExpenseForm({ expense, mode }: ExpenseFormProps) {
  const navigate = useNavigate()

  const { data: categories } = useSuspenseQuery(convexQuery(api.categories.list, {}))
  const { data: merchants } = useSuspenseQuery(convexQuery(api.expenses.getMerchants, {}))

  // Stable initial values — computed once on mount for both the form and
  // the dirty comparison. Using useState with an initializer avoids
  // recomputation on re-renders. For complete-draft mode, missing fields
  // get empty/null defaults so the user fills them in.
  const [defaultFormValues] = useState(() => ({
    date: expense?.date || (mode === 'complete-draft' ? '' : getTodayISO()),
    merchant: expense?.merchant || '',
    amount: expense?.amount !== undefined ? centsToInputValue(expense.amount) : '',
    categoryId: (expense?.categoryId ?? null) as string | null,
    newCategoryName: '',
    comment: expense?.comment || '',
  }))
  const [initialAttachmentId] = useState(() => expense?.attachmentId)

  const [attachmentId, setAttachmentId] = useState<Id<'_storage'> | undefined>(
    expense?.attachmentId,
  )
  const [isUploading, setIsUploading] = useState(false)
  const [showDeleteExpense, setShowDeleteExpense] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isNavigatingAway, setIsNavigatingAway] = useState(false)

  const navigateAway = useCallback(() => {
    setIsNavigatingAway(true)
  }, [])

  const createExpense = useMutation({
    mutationFn: useConvexMutation(api.expenses.create),
    onSuccess: () => {
      toast.success('Expense created')
      navigateAway()
    },
    onError: () => {
      toast.error('Error creating expense')
    },
  })

  const updateExpense = useMutation({
    mutationFn: useConvexMutation(api.expenses.update),
    onSuccess: () => {
      toast.success('Expense updated')
      navigateAway()
    },
    onError: () => {
      toast.error('Error updating expense')
    },
  })

  const completeDraft = useMutation({
    mutationFn: useConvexMutation(api.expenses.completeDraft),
    onSuccess: () => {
      toast.success('Draft completed')
      navigateAway()
    },
    onError: () => {
      toast.error('Error completing draft')
    },
  })

  const updateDraft = useMutation({
    mutationFn: useConvexMutation(api.expenses.updateDraft),
    onSuccess: () => {
      toast.success('Draft saved')
      navigateAway()
    },
    onError: () => {
      toast.error('Error saving draft')
    },
  })

  const deleteExpense = useMutation({
    mutationFn: useConvexMutation(api.expenses.remove),
    onSuccess: () => {
      toast.success('Expense deleted')
      navigateAway()
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
    defaultValues: defaultFormValues,
    validators: {
      onSubmit: expenseFormSchema,
    },
    onSubmit: async ({ value }) => {
      const amountCents = parseCurrencyToCents(value.amount)

      if (mode === 'complete-draft' && expense) {
        try {
          await completeDraft.mutateAsync({
            id: expense._id,
            date: value.date,
            merchant: value.merchant.trim(),
            amount: amountCents,
            ...(value.categoryId
              ? { categoryId: value.categoryId as Id<'categories'> }
              : { newCategoryName: value.newCategoryName.trim() }),
            attachmentId,
            comment: value.comment.trim() || undefined,
          })
        } catch {
          // Error toast shown by mutation onError callbacks
        }
        return
      }

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

  const isFormDirty = useStore(form.store, (s) => !s.isDefaultValue)
  const isDirty = !isNavigatingAway && (isFormDirty || attachmentId !== initialAttachmentId)

  const blocker = useUnsavedChangesGuard(isDirty)

  useEffect(() => {
    if (isNavigatingAway) {
      navigate({ to: '/dashboard' })
    }
  }, [isNavigatingAway, navigate])

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
      } catch (error) {
        toast.error(
          error instanceof Error && /too many/i.test(error.message)
            ? 'Too many uploads. Please wait a moment and try again.'
            : 'Error uploading file',
        )
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

  async function handleSaveDraft() {
    if (!expense) return

    const values = form.state.values

    // Strip empty strings so the draft schema's optional validators
    // receive undefined rather than invalid empty values.
    const toValidate: Record<string, unknown> = {}
    if (values.date) toValidate.date = values.date
    if (values.merchant.trim()) toValidate.merchant = values.merchant.trim()
    if (values.amount) toValidate.amount = values.amount
    if (values.categoryId) toValidate.categoryId = values.categoryId
    if (values.newCategoryName?.trim()) toValidate.newCategoryName = values.newCategoryName.trim()
    if (values.comment?.trim()) toValidate.comment = values.comment.trim()

    const parsed = draftExpenseFormSchema.safeParse(toValidate)
    if (!parsed.success) {
      const firstMsg = parsed.error.issues[0]?.message
      toast.error(firstMsg ?? 'Invalid field values')
      return
    }

    const draftData: {
      id: Id<'expenses'>
      date?: string
      merchant?: string
      amount?: number
      categoryId?: Id<'categories'>
      newCategoryName?: string
      comment?: string
      attachmentId?: Id<'_storage'>
    } = { id: expense._id }

    if (values.date) draftData.date = values.date
    if (values.merchant.trim()) draftData.merchant = values.merchant.trim()
    if (values.amount) {
      const amountCents = parseCurrencyToCents(values.amount)
      if (amountCents > 0) draftData.amount = amountCents
    }
    if (values.categoryId) {
      draftData.categoryId = values.categoryId as Id<'categories'>
    } else if (values.newCategoryName?.trim()) {
      draftData.newCategoryName = values.newCategoryName.trim()
    }
    if (values.comment?.trim()) draftData.comment = values.comment.trim()
    if (attachmentId) draftData.attachmentId = attachmentId

    try {
      await updateDraft.mutateAsync(draftData)
    } catch {
      // Error toast shown by mutation onError callbacks
    }
  }

  const isLoading =
    form.state.isSubmitting ||
    createExpense.isPending ||
    updateExpense.isPending ||
    completeDraft.isPending ||
    updateDraft.isPending ||
    deleteExpense.isPending ||
    removeAttachment.isPending ||
    isUploading

  return (
    <>
      <UnsavedChangesDialog
        open={blocker.status === 'blocked'}
        onStay={() => blocker.status === 'blocked' && blocker.reset()}
        onLeave={() => blocker.status === 'blocked' && blocker.proceed()}
      />
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
                : mode === 'complete-draft'
                  ? 'Save as complete'
                  : 'Save changes'}
          </Button>
          {mode === 'complete-draft' && (
            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={handleSaveDraft}
            >
              {updateDraft.isPending ? 'Saving...' : 'Save draft'}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => navigate({ to: '/dashboard' })}
          >
            Cancel
          </Button>

          {(mode === 'edit' || mode === 'complete-draft') && expense && (
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
    </>
  )
}
