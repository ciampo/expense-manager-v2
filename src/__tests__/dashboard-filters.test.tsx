import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Id } from '../../convex/_generated/dataModel'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (_opts: unknown) => null,
  Link: ({ children, to, params, ...rest }: Record<string, unknown>) => {
    const href =
      typeof to === 'string' && params && typeof params === 'object' && 'expenseId' in params
        ? `/expenses/${(params as { expenseId: string }).expenseId}`
        : (to as string)
    return (
      <a href={href} {...rest}>
        {children as React.ReactNode}
      </a>
    )
  },
  useNavigate: () => mockNavigate,
}))

let mockDraftCount = 3

const convexMutationSpies: Record<string, ReturnType<typeof vi.fn>> = {}
let useSuspenseQueryImpl: (queryOptions: unknown) => { data: unknown }
let useQueryImpl: (config: unknown) => { data: unknown; isLoading: boolean; isError: boolean }

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: vi.fn((...args: unknown[]) => ({ queryKey: args })),
  useConvexMutation: vi.fn((apiRef: string) => {
    if (!convexMutationSpies[apiRef]) {
      convexMutationSpies[apiRef] = vi.fn()
    }
    return convexMutationSpies[apiRef]
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useSuspenseQuery: vi.fn((queryOptions: unknown) => useSuspenseQueryImpl(queryOptions)),
  useQuery: vi.fn((config: unknown) => useQueryImpl(config)),
  useMutation: vi.fn((config: { mutationFn?: (variables: unknown) => unknown }) => ({
    mutate: vi.fn((variables?: unknown) => {
      try {
        config.mutationFn?.(variables)
      } catch {
        // noop
      }
    }),
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  })),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    categories: { list: 'categories.list' },
    expenses: {
      list: 'expenses.list',
      remove: 'expenses.remove',
      draftCount: 'expenses.draftCount',
    },
    storage: {
      getUrl: 'storage.getUrl',
    },
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockCategories = [
  { _id: 'cat1', name: 'Food', icon: '🍕', isPredefined: true },
  { _id: 'cat2', name: 'Transport', icon: '🚗', isPredefined: false },
]

const completeExpense = {
  _id: 'exp1' as Id<'expenses'>,
  isDraft: false,
  date: '2026-03-15',
  merchant: 'Coffee Shop',
  amount: 1250,
  categoryId: 'cat1' as Id<'categories'>,
  attachmentId: undefined,
}

const draftExpense = {
  _id: 'exp2' as Id<'expenses'>,
  isDraft: true,
  date: undefined,
  merchant: undefined,
  amount: undefined,
  categoryId: undefined,
  attachmentId: 'storage1' as Id<'_storage'>,
}

const draftExpensePartial = {
  _id: 'exp3' as Id<'expenses'>,
  isDraft: true,
  date: '2026-03-20',
  merchant: 'Grocery Store',
  amount: undefined,
  categoryId: undefined,
  attachmentId: undefined,
}

// ---------------------------------------------------------------------------
// Dynamic import after mocks
// ---------------------------------------------------------------------------

// We need to import the components dynamically, but since we're using
// vi.mock at the top level, we can import after the mocks are set up.
// The dashboard file exports a Route object from createFileRoute, and we
// need to access the internal components. To work around this, we'll
// re-export the components via a test-friendly approach.

// Instead, we'll import the dashboard module and test through the
// Route component. But since createFileRoute is mocked, we need to
// access the components differently.

// The simplest approach: import the dashboard module to get the functions
// declared inside, but since they're not exported, we test via the
// rendered Route component. However, createFileRoute is mocked to return
// null, so we need a different strategy.

// Let's use a helper approach: directly test the rendering by importing
// the file which registers the route, then render the page component.

// Actually, the cleanest approach for this test pattern is to extract
// the components or test indirectly. Given the existing test patterns in
// the codebase, let's keep it simple and test via rendering.

// We need the dashboard module's internal components. Let's mock
// createFileRoute to capture the component.
let DashboardComponent: React.ComponentType | null = null

vi.mock('@tanstack/react-router', async () => {
  return {
    createFileRoute: () => (opts: { component?: React.ComponentType }) => {
      DashboardComponent = opts.component ?? null
      return null
    },
    Link: ({ children, to, params, ...rest }: Record<string, unknown>) => {
      const href =
        typeof to === 'string' && params && typeof params === 'object' && 'expenseId' in params
          ? `/expenses/${(params as { expenseId: string }).expenseId}`
          : (to as string)
      return (
        <a href={href} {...rest}>
          {children as React.ReactNode}
        </a>
      )
    },
    useNavigate: () => mockNavigate,
  }
})

// Trigger module evaluation to capture DashboardComponent
await import('@/routes/_authenticated/dashboard')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard filters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDraftCount = 3

    useSuspenseQueryImpl = (queryOptions: unknown) => {
      const args = queryOptions as { queryKey: unknown[] }
      const key = args.queryKey?.[0]

      if (key === 'categories.list') {
        return { data: mockCategories }
      }
      if (key === 'expenses.draftCount') {
        return { data: mockDraftCount }
      }
      if (key === 'expenses.list') {
        const filterArg = args.queryKey?.[1] as { isDraft?: boolean } | undefined
        const isDraft = filterArg?.isDraft

        let expenses = [completeExpense, draftExpense, draftExpensePartial]
        if (isDraft === false) {
          expenses = [completeExpense]
        } else if (isDraft === true) {
          expenses = [draftExpense, draftExpensePartial]
        }

        return {
          data: {
            expenses,
            continueCursor: null,
            isDone: true,
          },
        }
      }
      return { data: null }
    }

    useQueryImpl = () => ({
      data: null,
      isLoading: false,
      isError: false,
    })
  })

  function renderDashboard() {
    if (!DashboardComponent) {
      throw new Error('DashboardComponent was not captured from createFileRoute mock')
    }
    return render(<DashboardComponent />)
  }

  describe('Tab rendering', () => {
    it('renders Complete, Drafts, and All tabs', () => {
      renderDashboard()

      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(3)
      expect(tabs[0].textContent).toContain('Complete')
      expect(tabs[1].textContent).toContain('Drafts')
      expect(tabs[2].textContent).toContain('All')
    })

    it('shows draft count badge in the Drafts tab', () => {
      renderDashboard()

      const draftsTab = screen.getAllByRole('tab')[1]
      expect(draftsTab.textContent).toContain('3')
    })

    it('hides draft count badge when count is zero', () => {
      mockDraftCount = 0
      useSuspenseQueryImpl = (queryOptions: unknown) => {
        const args = queryOptions as { queryKey: unknown[] }
        const key = args.queryKey?.[0]
        if (key === 'expenses.draftCount') return { data: 0 }
        if (key === 'categories.list') return { data: mockCategories }
        if (key === 'expenses.list') {
          return {
            data: { expenses: [completeExpense], continueCursor: null, isDone: true },
          }
        }
        return { data: null }
      }

      renderDashboard()

      const draftsTab = screen.getAllByRole('tab')[1]
      expect(draftsTab.textContent).toContain('Drafts')
      expect(draftsTab.querySelector('[data-slot="badge"]')).toBeNull()
    })

    it('defaults to Complete tab being active', () => {
      renderDashboard()

      const completeTab = screen.getAllByRole('tab')[0]
      expect(completeTab.hasAttribute('data-active')).toBe(true)
    })
  })

  describe('Tab switching updates query args', () => {
    it('passes isDraft: false when Complete tab is active (default)', () => {
      renderDashboard()

      // Default view is "Complete" — only complete expenses should be shown
      expect(screen.getByText('Coffee Shop')).toBeDefined()
    })

    it('passes isDraft: true when Drafts tab is clicked', () => {
      renderDashboard()

      const draftsTab = screen.getAllByRole('tab')[1]
      fireEvent.click(draftsTab)

      // Draft rows should appear
      expect(screen.getAllByText('Draft')).toHaveLength(2)
    })

    it('passes isDraft: undefined when All tab is clicked', () => {
      renderDashboard()

      const allTab = screen.getAllByRole('tab')[2]
      fireEvent.click(allTab)

      // All expenses (both complete and draft) should appear
      expect(screen.getByText('Coffee Shop')).toBeDefined()
      expect(screen.getAllByText('Draft').length).toBeGreaterThan(0)
    })
  })

  describe('Draft row styling', () => {
    it('shows "—" for missing date on draft rows', () => {
      renderDashboard()

      const draftsTab = screen.getAllByRole('tab')[1]
      fireEvent.click(draftsTab)

      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThan(0)
    })

    it('shows "—" for missing merchant on draft rows', () => {
      renderDashboard()

      const draftsTab = screen.getAllByRole('tab')[1]
      fireEvent.click(draftsTab)

      // The fully empty draft should show "—" for merchant
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(1)
    })

    it('shows a "Draft" badge on draft rows', () => {
      renderDashboard()

      const draftsTab = screen.getAllByRole('tab')[1]
      fireEvent.click(draftsTab)

      const badges = screen.getAllByText('Draft')
      expect(badges.length).toBe(2)
      badges.forEach((badge) => {
        expect(badge.closest('[data-slot="badge"]')).not.toBeNull()
      })
    })
  })

  describe('Draft row actions', () => {
    it('shows "Complete" button for draft rows instead of "Edit"', () => {
      renderDashboard()

      const draftsTab = screen.getAllByRole('tab')[1]
      fireEvent.click(draftsTab)

      const completeButtons = screen.getAllByRole('link', { name: /Complete .* expense/i })
      expect(completeButtons.length).toBe(2)
    })

    it('"Complete" button links to the correct expense edit URL', () => {
      renderDashboard()

      const draftsTab = screen.getAllByRole('tab')[1]
      fireEvent.click(draftsTab)

      const completeLink = screen.getAllByRole('link', { name: /Complete .* expense/i })[0]
      expect(completeLink.getAttribute('href')).toBe(`/expenses/${draftExpense._id}`)
    })

    it('shows "Edit" button for complete expense rows', () => {
      renderDashboard()

      const editButton = screen.getByRole('link', { name: /Edit Coffee Shop expense/i })
      expect(editButton).toBeDefined()
    })
  })

  describe('Header buttons', () => {
    it('renders "Upload receipts" button', () => {
      renderDashboard()

      const uploadButton = screen.getByRole('link', { name: /Upload receipts/i })
      expect(uploadButton.getAttribute('href')).toBe('/expenses/upload')
    })

    it('renders "+ New expense" button', () => {
      renderDashboard()

      const newButton = screen.getByRole('link', { name: /\+ New expense/i })
      expect(newButton.getAttribute('href')).toBe('/expenses/new')
    })
  })
})
