import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Shared state (vi.hoisted ensures availability in hoisted vi.mock factories)
// ---------------------------------------------------------------------------

const { state } = vi.hoisted(() => {
  const state = {
    mockApiKeys: [] as Array<{
      _id: string
      name: string
      prefix: string
      createdAt: number
      lastUsedAt?: number
    }>,
  }
  return { state }
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: vi.fn((...args: unknown[]) => ({ queryKey: args })),
  useConvexMutation: vi.fn(() => vi.fn()),
}))

vi.mock('@tanstack/react-query', () => ({
  useSuspenseQuery: vi.fn((queryOptions: unknown) => {
    const args = queryOptions as { queryKey: unknown[] }
    const key = args.queryKey?.[0]

    if (key === 'apiKeys.list') return { data: state.mockApiKeys }
    if (key === 'categories.listWithCounts') return { data: [] }
    if (key === 'merchants.listWithCounts') return { data: [] }
    return { data: [] }
  }),
  useMutation: vi.fn((config: { onSuccess?: (_data: unknown) => void }) => {
    return {
      mutate: vi.fn((..._args: unknown[]) => {
        try {
          config.onSuccess?.({
            rawKey: 'em_abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
          })
        } catch {
          /* noop */
        }
      }),
      mutateAsync: vi.fn(),
      isPending: false,
    }
  }),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    categories: {
      listWithCounts: 'categories.listWithCounts',
      rename: 'categories.rename',
      remove: 'categories.remove',
    },
    merchants: {
      listWithCounts: 'merchants.listWithCounts',
      rename: 'merchants.rename',
      remove: 'merchants.remove',
    },
    apiKeys: {
      list: 'apiKeys.list',
      create: 'apiKeys.create',
      revoke: 'apiKeys.revoke',
    },
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Capture the settings page component
// ---------------------------------------------------------------------------

let SettingsComponent: React.ComponentType | null = null

vi.mock('@tanstack/react-router', async () => {
  return {
    createFileRoute: () => (opts: { component?: React.ComponentType }) => {
      SettingsComponent = opts.component ?? null
      return null
    },
    Link: ({ children, ...rest }: Record<string, unknown>) => (
      <a {...rest}>{children as React.ReactNode}</a>
    ),
  }
})

await import('@/routes/_authenticated/settings')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Settings — API Keys section', () => {
  beforeEach(() => {
    state.mockApiKeys = []
  })

  function renderSettings() {
    if (!SettingsComponent) {
      throw new Error('SettingsComponent was not captured from createFileRoute mock')
    }
    return render(<SettingsComponent />)
  }

  describe('Create form', () => {
    it('renders the API Keys section with create form', () => {
      renderSettings()

      expect(screen.getByText('API Keys')).toBeDefined()
      expect(screen.getByLabelText('Key name')).toBeDefined()
      expect(screen.getByRole('button', { name: /Generate/i })).toBeDefined()
    })

    it('disables Generate button when input is empty', () => {
      renderSettings()

      const button = screen.getByRole('button', { name: /Generate/i })
      expect(button.hasAttribute('disabled')).toBe(true)
    })

    it('enables Generate button when input has text', () => {
      renderSettings()

      const input = screen.getByLabelText('Key name')
      fireEvent.change(input, { target: { value: 'My Key' } })

      const button = screen.getByRole('button', { name: /Generate/i })
      expect(button.hasAttribute('disabled')).toBe(false)
    })
  })

  describe('New key display', () => {
    it('shows the raw key after creation with copy button and warning', () => {
      renderSettings()

      const input = screen.getByLabelText('Key name')
      fireEvent.change(input, { target: { value: 'iOS Shortcuts' } })
      fireEvent.submit(input.closest('form')!)

      expect(screen.getByText(/Copy this key now/)).toBeDefined()
      expect(screen.getByRole('button', { name: /Copy/i })).toBeDefined()
    })

    it('dismisses the key display when Dismiss is clicked', () => {
      renderSettings()

      const input = screen.getByLabelText('Key name')
      fireEvent.change(input, { target: { value: 'Test' } })
      fireEvent.submit(input.closest('form')!)

      expect(screen.getByText(/Copy this key now/)).toBeDefined()

      fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }))

      expect(screen.queryByText(/Copy this key now/)).toBeNull()
    })
  })

  describe('Key list', () => {
    it('shows empty state when no keys exist', () => {
      renderSettings()

      expect(screen.getByText(/No API keys yet/)).toBeDefined()
    })

    it('displays key list table with prefix and name', () => {
      state.mockApiKeys = [
        {
          _id: 'key1',
          name: 'iOS Shortcuts',
          prefix: 'em_abc12',
          createdAt: new Date('2026-03-15').getTime(),
          lastUsedAt: new Date('2026-03-20').getTime(),
        },
      ]

      renderSettings()

      expect(screen.getByText('iOS Shortcuts')).toBeDefined()
      expect(screen.getByText('em_abc12...')).toBeDefined()
    })

    it('shows "Never" for keys that have not been used', () => {
      state.mockApiKeys = [
        {
          _id: 'key1',
          name: 'Unused Key',
          prefix: 'em_def34',
          createdAt: new Date('2026-03-10').getTime(),
        },
      ]

      renderSettings()

      expect(screen.getByText('Never')).toBeDefined()
    })

    it('displays multiple keys', () => {
      state.mockApiKeys = [
        {
          _id: 'key1',
          name: 'iOS Shortcuts',
          prefix: 'em_abc12',
          createdAt: new Date('2026-03-15').getTime(),
        },
        {
          _id: 'key2',
          name: 'Zapier',
          prefix: 'em_def34',
          createdAt: new Date('2026-03-10').getTime(),
        },
      ]

      renderSettings()

      expect(screen.getByText('iOS Shortcuts')).toBeDefined()
      expect(screen.getByText('Zapier')).toBeDefined()
      expect(screen.getByText('em_abc12...')).toBeDefined()
      expect(screen.getByText('em_def34...')).toBeDefined()
    })
  })

  describe('Revoke', () => {
    it('shows revoke button for each key', () => {
      state.mockApiKeys = [
        {
          _id: 'key1',
          name: 'My Key',
          prefix: 'em_abc12',
          createdAt: Date.now(),
        },
      ]

      renderSettings()

      expect(screen.getByRole('button', { name: /Revoke My Key/i })).toBeDefined()
    })

    it('shows confirmation dialog when revoke is clicked', () => {
      state.mockApiKeys = [
        {
          _id: 'key1',
          name: 'My Key',
          prefix: 'em_abc12',
          createdAt: Date.now(),
        },
      ]

      renderSettings()

      fireEvent.click(screen.getByRole('button', { name: /Revoke My Key/i }))

      expect(screen.getByText(/Revoke API key\?/)).toBeDefined()
      expect(screen.getByText(/will be permanently revoked/)).toBeDefined()
    })
  })
})
