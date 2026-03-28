import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { api } from '../../../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { RouteErrorComponent } from '@/components/route-error'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog'
import { MAX_FILE_SIZE, ALLOWED_CONTENT_TYPES } from '@/lib/schemas'
import { toast } from 'sonner'
import { useCallback, useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/_authenticated/expenses/upload')({
  component: UploadPage,
  errorComponent: RouteErrorComponent,
  head: () => ({
    meta: [{ title: 'Upload Receipts — Expense Manager' }],
  }),
})

// ── Constants ────────────────────────────────────────────────────────────

const MAX_BATCH_SIZE = 20
const MAX_CONCURRENT = 3

const ALLOWED_EXTENSIONS = ALLOWED_CONTENT_TYPES.map((t) => {
  const ext = t.split('/')[1]
  if (ext === 'jpeg') return '.jpg/.jpeg'
  return `.${ext}`
}).join(', ')

const MAX_SIZE_LABEL = `${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB`

// ── Types ────────────────────────────────────────────────────────────────

type FileStatus = 'queued' | 'uploading' | 'creating-draft' | 'done' | 'error'

interface UploadItem {
  id: string
  file: File
  status: FileStatus
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

function validateFile(file: File): string | null {
  if (file.size === 0) {
    return 'File is empty'
  }
  if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
    return 'Unsupported file type. Use images or PDF.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large. Maximum ${MAX_SIZE_LABEL}.`
  }
  return null
}

// ── Component ────────────────────────────────────────────────────────────

function UploadPage() {
  const [items, setItems] = useState<UploadItem[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processingRef = useRef(false)
  const dragCounterRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const { mutateAsync: generateUploadUrl } = useMutation({
    mutationFn: useConvexMutation(api.storage.generateUploadUrl),
  })
  const { mutateAsync: confirmUpload } = useMutation({
    mutationFn: useConvexMutation(api.storage.confirmUpload),
  })
  const { mutateAsync: createDraft } = useMutation({
    mutationFn: useConvexMutation(api.expenses.createDraft),
  })

  // ── Derived state ────────────────────────────────────────────────────

  const hasActiveUploads = items.some(
    (i) => i.status === 'queued' || i.status === 'uploading' || i.status === 'creating-draft',
  )
  const doneCount = items.filter((i) => i.status === 'done').length
  const errorCount = items.filter((i) => i.status === 'error').length
  const uploadableCount = items.length - errorCount
  const isComplete = items.length > 0 && !hasActiveUploads

  // ── Abort in-flight uploads on unmount ────────────────────────────────

  useEffect(() => {
    return () => abortControllerRef.current?.abort()
  }, [])

  // ── Unsaved changes guard ────────────────────────────────────────────

  const blocker = useUnsavedChangesGuard(hasActiveUploads)

  // ── File selection ───────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    let slotsAvailable = 0

    setItems((prev) => {
      const remaining = MAX_BATCH_SIZE - prev.length
      slotsAvailable = remaining
      if (remaining <= 0) return prev

      const toAdd = fileArray.slice(0, remaining)
      const newItems: UploadItem[] = toAdd.map((file) => {
        const validationError = validateFile(file)
        return {
          id: crypto.randomUUID(),
          file,
          status: validationError ? ('error' as const) : ('queued' as const),
          error: validationError ?? undefined,
        }
      })

      return [...prev, ...newItems]
    })

    if (slotsAvailable <= 0) {
      toast.error(`Batch limit reached (max ${MAX_BATCH_SIZE} files)`)
    } else if (fileArray.length > slotsAvailable) {
      toast.error(`Only ${slotsAvailable} more file(s) can be added (max ${MAX_BATCH_SIZE})`)
    }
  }, [])

  // ── Drag & drop handlers ─────────────────────────────────────────────
  // Uses a counter to avoid flicker when the cursor moves over child
  // elements (each child fires dragEnter/dragLeave on the parent).

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
    setIsDragOver(true)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files)
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [addFiles],
  )

  // ── Upload pipeline (per file) ───────────────────────────────────────

  const updateItem = useCallback(
    (id: string, patch: Partial<Pick<UploadItem, 'status' | 'error'>>) => {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    },
    [],
  )

  const processFile = useCallback(
    async (item: UploadItem, signal: AbortSignal) => {
      try {
        updateItem(item.id, { status: 'uploading' })

        const uploadUrl = await generateUploadUrl({})

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': item.file.type },
          body: item.file,
          signal,
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        const json: unknown = await response.json()
        const storageId = (json as Record<string, unknown>)?.storageId
        if (!storageId) {
          throw new Error('Upload response missing storageId')
        }

        if (signal.aborted) return
        await confirmUpload({ storageId })

        if (signal.aborted) return
        updateItem(item.id, { status: 'creating-draft' })
        await createDraft({ attachmentId: storageId })

        if (signal.aborted) return
        updateItem(item.id, { status: 'done' })
      } catch (error) {
        if (signal.aborted) return

        const message =
          error instanceof Error && /too many/i.test(error.message)
            ? 'Too many uploads. Please wait a moment and try again.'
            : error instanceof Error
              ? error.message
              : 'Upload failed'
        updateItem(item.id, { status: 'error', error: message })
      }
    },
    [generateUploadUrl, confirmUpload, createDraft, updateItem],
  )

  // ── Upload orchestrator ──────────────────────────────────────────────

  useEffect(() => {
    if (processingRef.current) return

    const queued = items.filter((i) => i.status === 'queued')
    const active = items.filter((i) => i.status === 'uploading' || i.status === 'creating-draft')
    const slots = MAX_CONCURRENT - active.length

    if (slots <= 0 || queued.length === 0) return

    processingRef.current = true
    const batch = queued.slice(0, slots)
    abortControllerRef.current = new AbortController()

    Promise.all(batch.map((item) => processFile(item, abortControllerRef.current!.signal))).finally(
      () => {
        processingRef.current = false
        // Force a re-render so the effect re-evaluates the queue and picks
        // up remaining items. Without this, the effect may not re-fire after
        // the ref is cleared because no state change is guaranteed.
        setItems((prev) => [...prev])
      },
    )
  }, [items, processFile])

  // ── Retry handler ────────────────────────────────────────────────────

  const handleRetry = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const validationError = validateFile(item.file)
        return validationError
          ? { ...item, status: 'error' as const, error: validationError }
          : { ...item, status: 'queued' as const, error: undefined }
      }),
    )
  }, [])

  // ── Reset for another batch ──────────────────────────────────────────

  const handleReset = useCallback(() => {
    setItems([])
    dragCounterRef.current = 0
    setIsDragOver(false)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <>
      <UnsavedChangesDialog
        open={blocker.status === 'blocked'}
        onStay={() => blocker.status === 'blocked' && blocker.reset()}
        onLeave={() => blocker.status === 'blocked' && blocker.proceed()}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Upload receipts</h1>
          <p className="text-muted-foreground">
            Drop receipt images to create draft expenses in bulk
          </p>
        </div>

        {/* Dropzone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop files here or click to browse"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          className={`mb-2 flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }`}
        >
          <div className="text-center">
            <p className="mb-2 text-lg font-medium">
              {isDragOver ? 'Drop files here' : 'Drag & drop receipt files'}
            </p>
            <p className="text-muted-foreground mb-4 text-sm">or</p>
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              Browse files
            </Button>
          </div>
        </div>

        <p className="text-muted-foreground mb-8 text-xs">
          Accepted: {ALLOWED_EXTENSIONS} — Max {MAX_SIZE_LABEL} per file — Up to {MAX_BATCH_SIZE}{' '}
          files per batch
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_CONTENT_TYPES.join(',')}
          onChange={handleFileInput}
          className="hidden"
          aria-label="Upload receipt files"
        />

        {/* File list */}
        {items.length > 0 && (
          <div className="space-y-4">
            {/* Summary (when complete) */}
            {isComplete && (
              <div className="bg-muted/30 rounded-lg border p-4" role="status">
                <p className="mb-3 text-sm font-medium">
                  {doneCount > 0 && (
                    <span>
                      {doneCount} draft{doneCount !== 1 ? 's' : ''} created
                    </span>
                  )}
                  {doneCount > 0 && errorCount > 0 && <span>, </span>}
                  {errorCount > 0 && <span className="text-destructive">{errorCount} failed</span>}
                </p>
                <div className="flex gap-3">
                  {doneCount > 0 && (
                    <Button render={<Link to="/dashboard" />} size="sm">
                      View drafts
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Upload more
                  </Button>
                </div>
              </div>
            )}

            {/* Progress header */}
            {hasActiveUploads && (
              <p className="text-muted-foreground text-sm" role="status" aria-live="polite">
                Uploading… {doneCount} of {uploadableCount} complete
              </p>
            )}

            {/* Individual files */}
            <ul className="divide-y rounded-lg border" aria-label="Upload queue">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.file.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatFileSize(item.file.size)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2" aria-live="polite">
                    <FileStatusBadge status={item.status} error={item.error} />
                    {item.status === 'error' && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleRetry(item.id)}
                        aria-label={`Retry ${item.file.name}`}
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────

function FileStatusBadge({ status, error }: { status: FileStatus; error?: string }) {
  switch (status) {
    case 'queued':
      return <span className="text-muted-foreground text-xs">Queued</span>
    case 'uploading':
      return <span className="text-primary text-xs font-medium">Uploading…</span>
    case 'creating-draft':
      return <span className="text-primary text-xs font-medium">Creating draft…</span>
    case 'done':
      return <span className="text-xs font-medium text-green-600 dark:text-green-400">Done</span>
    case 'error':
      return (
        <span className="text-destructive text-xs font-medium" role="alert">
          {error ?? 'Error'}
        </span>
      )
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
