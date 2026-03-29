import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MAX_FILE_SIZE, ALLOWED_CONTENT_TYPES } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBlocker = {
  status: 'idle' as const,
  current: undefined,
  next: undefined,
  action: undefined,
  proceed: vi.fn(),
  reset: vi.fn(),
}

let capturedComponent: React.ComponentType | null = null

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: { component: React.ComponentType }) => {
    capturedComponent = opts.component
    return opts
  },
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode
    to: string
    [k: string]: unknown
  }) => (
    <a href={to} data-testid="link" {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useBlocker: vi.fn(() => mockBlocker),
}))

const mutationSpies: Record<string, ReturnType<typeof vi.fn>> = {}

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: vi.fn((...args: unknown[]) => args),
  useConvexMutation: vi.fn((ref: string) => {
    if (!mutationSpies[ref]) mutationSpies[ref] = vi.fn()
    return mutationSpies[ref]
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn((config: { mutationFn?: (variables: unknown) => unknown }) => ({
    mutate: vi.fn((variables?: unknown) => {
      try {
        config.mutationFn?.(variables)
      } catch {
        /* swallowed */
      }
    }),
    mutateAsync: vi.fn((variables?: unknown) => {
      try {
        return Promise.resolve(config.mutationFn?.(variables))
      } catch (error) {
        return Promise.reject(error)
      }
    }),
    isPending: false,
  })),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    storage: {
      generateUploadUrl: 'storage.generateUploadUrl',
      confirmUpload: 'storage.confirmUpload',
    },
    expenses: {
      createDraft: 'expenses.createDraft',
    },
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size)
  return new File([buffer], name, { type })
}

function createValidFile(name = 'receipt.jpg'): File {
  return createFile(name, 1024, 'image/jpeg')
}

// Uses a plain File[] instead of a real FileList (which has no public
// constructor in JSDOM). This is acceptable because the component
// immediately calls Array.from(files) and never uses FileList-specific
// APIs like .item().
function dropFiles(dropzone: HTMLElement, files: File[]) {
  const dataTransfer = {
    files,
    types: ['Files'],
    items: files.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })),
  }

  fireEvent.dragEnter(dropzone, { dataTransfer })
  fireEvent.drop(dropzone, { dataTransfer })
}

function getDropzone() {
  return screen.getByRole('button', { name: /drop files here or click to browse/i })
}

// ---------------------------------------------------------------------------
// Setup — import the route module so createFileRoute captures the component
// ---------------------------------------------------------------------------

let UploadPage: React.ComponentType

beforeEach(async () => {
  vi.clearAllMocks()
  for (const key of Object.keys(mutationSpies)) delete mutationSpies[key]
  Object.assign(mockBlocker, { status: 'idle' })
  capturedComponent = null
  vi.resetModules()
  await import('@/routes/_authenticated/expenses/upload')
  UploadPage = capturedComponent!
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Bulk upload page', () => {
  describe('layout', () => {
    it('renders page title and description', () => {
      render(<UploadPage />)

      expect(screen.getByRole('heading', { name: 'Upload receipts' })).toBeDefined()
      expect(screen.getByText(/drop receipt images to create draft expenses/i)).toBeDefined()
    })

    it('renders the dropzone', () => {
      render(<UploadPage />)
      expect(getDropzone()).toBeDefined()
    })

    it('renders the Browse files button', () => {
      render(<UploadPage />)
      expect(screen.getByRole('button', { name: 'Browse files' })).toBeDefined()
    })

    it('shows accepted file types and size constraints', () => {
      render(<UploadPage />)

      const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024))
      expect(screen.getByText(new RegExp(`Max ${maxMB}MB per file`))).toBeDefined()
      expect(screen.getByText(/Up to 20 files per batch/)).toBeDefined()
    })
  })

  describe('file validation', () => {
    it('marks files with unsupported types as error', () => {
      render(<UploadPage />)

      dropFiles(getDropzone(), [createFile('doc.txt', 1024, 'text/plain')])

      expect(screen.getByText('doc.txt')).toBeDefined()
      expect(screen.getByText('Unsupported file type. Use images or PDF.')).toBeDefined()
    })

    it('marks files exceeding size limit as error', () => {
      render(<UploadPage />)

      dropFiles(getDropzone(), [createFile('huge.jpg', MAX_FILE_SIZE + 1, 'image/jpeg')])

      expect(screen.getByText('huge.jpg')).toBeDefined()
      expect(screen.getByText(/File too large\. Maximum/)).toBeDefined()
    })

    it('marks zero-byte files as error', () => {
      render(<UploadPage />)

      dropFiles(getDropzone(), [createFile('empty.jpg', 0, 'image/jpeg')])

      expect(screen.getByText('empty.jpg')).toBeDefined()
      expect(screen.getByText('File is empty')).toBeDefined()
    })

    it('accepts all allowed file types', () => {
      render(<UploadPage />)

      for (const type of ALLOWED_CONTENT_TYPES) {
        const ext = type.split('/')[1]
        dropFiles(getDropzone(), [createFile(`test.${ext}`, 1024, type)])
      }

      const items = screen.getByRole('list', { name: 'Upload queue' })
      const statuses = items.querySelectorAll('li')
      expect(statuses.length).toBe(ALLOWED_CONTENT_TYPES.length)
    })
  })

  describe('batch limit', () => {
    it('enforces the 20-file batch limit', () => {
      render(<UploadPage />)

      const files = Array.from({ length: 25 }, (_, i) => createValidFile(`receipt-${i + 1}.jpg`))
      dropFiles(getDropzone(), files)

      const list = screen.getByRole('list', { name: 'Upload queue' })
      expect(list.querySelectorAll('li').length).toBe(20)

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringContaining('max 20'))
    })

    it('limits additions when approaching the cap', () => {
      render(<UploadPage />)

      const batch1 = Array.from({ length: 18 }, (_, i) => createValidFile(`b1-${i + 1}.jpg`))
      dropFiles(getDropzone(), batch1)

      const batch2 = Array.from({ length: 5 }, (_, i) => createValidFile(`b2-${i + 1}.jpg`))
      dropFiles(getDropzone(), batch2)

      const list = screen.getByRole('list', { name: 'Upload queue' })
      expect(list.querySelectorAll('li').length).toBe(20)
    })

    it('shows toast when batch is already full', () => {
      render(<UploadPage />)

      const files = Array.from({ length: 20 }, (_, i) => createValidFile(`r-${i + 1}.jpg`))
      dropFiles(getDropzone(), files)

      vi.mocked(toast.error).mockClear()

      dropFiles(getDropzone(), [createValidFile('extra.jpg')])

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringContaining('max 20'))
    })
  })

  describe('per-file progress states', () => {
    it('shows queued status for valid files', () => {
      render(<UploadPage />)

      dropFiles(getDropzone(), [createValidFile()])

      // Valid files start as queued but the orchestrator effect picks them
      // up immediately, so they may show as "Uploading…" by the time we
      // query. Either state is acceptable.
      const status = screen.queryByText('Queued') ?? screen.queryByText('Uploading…')
      expect(status).not.toBeNull()
    })

    it('shows error status with retry button for invalid files', () => {
      render(<UploadPage />)

      dropFiles(getDropzone(), [createFile('bad.txt', 1024, 'text/plain')])

      expect(screen.getByText('Unsupported file type. Use images or PDF.')).toBeDefined()
      expect(screen.getByRole('button', { name: /retry/i })).toBeDefined()
    })

    it('shows file name and size for each item', () => {
      render(<UploadPage />)

      dropFiles(getDropzone(), [createValidFile('my-receipt.jpg')])

      expect(screen.getByText('my-receipt.jpg')).toBeDefined()
      expect(screen.getByText('1.0 KB')).toBeDefined()
    })

    it('shows progress text while uploads are active', () => {
      render(<UploadPage />)

      dropFiles(getDropzone(), [createValidFile()])

      // "Uploading… 0 of 1 complete" or status badge "Uploading…"
      const progressText = screen.getAllByText(/Uploading…/)
      expect(progressText.length).toBeGreaterThan(0)
    })
  })

  describe('post-completion summary', () => {
    it('shows summary when all files are in terminal state', () => {
      render(<UploadPage />)

      // Invalid files immediately reach terminal error state
      dropFiles(getDropzone(), [
        createFile('a.txt', 100, 'text/plain'),
        createFile('b.txt', 100, 'text/plain'),
      ])

      expect(screen.getByText(/2 failed/)).toBeDefined()
      expect(screen.getByRole('button', { name: 'Upload more' })).toBeDefined()
    })

    it('"Upload more" resets the page', () => {
      render(<UploadPage />)

      dropFiles(getDropzone(), [createFile('a.txt', 100, 'text/plain')])

      fireEvent.click(screen.getByRole('button', { name: 'Upload more' }))

      expect(screen.queryByText('a.txt')).toBeNull()
      expect(screen.queryByRole('list', { name: 'Upload queue' })).toBeNull()
    })
  })

  describe('drag interaction', () => {
    it('shows "Drop files here" during drag enter', () => {
      render(<UploadPage />)

      fireEvent.dragEnter(getDropzone(), {
        dataTransfer: { files: [], types: ['Files'], items: [] },
      })

      expect(screen.getByText('Drop files here')).toBeDefined()
    })

    it('restores default text on drag leave', () => {
      render(<UploadPage />)

      const dropzone = getDropzone()

      fireEvent.dragEnter(dropzone, {
        dataTransfer: { files: [], types: ['Files'], items: [] },
      })
      fireEvent.dragLeave(dropzone, {
        dataTransfer: { files: [], types: ['Files'], items: [] },
      })

      expect(screen.getByText('Drag & drop receipt files')).toBeDefined()
    })
  })

  describe('unsaved changes guard', () => {
    it('does not show unsaved changes dialog when blocker is idle', () => {
      render(<UploadPage />)
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })

    it('shows unsaved changes dialog when blocker is blocked', () => {
      Object.assign(mockBlocker, { status: 'blocked' })

      render(<UploadPage />)

      expect(screen.getByRole('alertdialog')).toBeDefined()
      expect(screen.getByText('Unsaved changes')).toBeDefined()
    })

    it('enables the blocker when uploads are active', async () => {
      const { useBlocker } = await import('@tanstack/react-router')
      render(<UploadPage />)

      dropFiles(getDropzone(), [createValidFile()])

      const lastCall = vi.mocked(useBlocker).mock.calls.at(-1)?.[0] as
        | { disabled?: boolean }
        | undefined
      expect(lastCall?.disabled).toBe(false)
    })
  })

  describe('happy path — successful upload', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ storageId: 'test-storage-id' }),
          }),
        ),
      )
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('transitions file through to Done status and calls mutations in order', async () => {
      render(<UploadPage />)

      dropFiles(getDropzone(), [createValidFile()])

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeDefined()
      })

      const confirmSpy = mutationSpies['storage.confirmUpload']
      const createDraftSpy = mutationSpies['expenses.createDraft']

      expect(confirmSpy).toHaveBeenCalledWith({ storageId: 'test-storage-id' })
      expect(createDraftSpy).toHaveBeenCalledWith({ attachmentId: 'test-storage-id' })
    })

    it('shows post-completion summary with draft count', async () => {
      render(<UploadPage />)

      dropFiles(getDropzone(), [createValidFile()])

      await waitFor(() => {
        expect(screen.getByText(/1 draft created/)).toBeDefined()
      })

      expect(screen.getByRole('button', { name: 'Upload more' })).toBeDefined()
    })

    it('shows dashboard link after successful uploads', async () => {
      render(<UploadPage />)

      dropFiles(getDropzone(), [createValidFile()])

      await waitFor(() => {
        expect(screen.getByText('Go to dashboard')).toBeDefined()
      })
    })
  })
})
