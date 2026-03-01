import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { z } from 'zod'
import { expenseDateSchema, expenseMerchantSchema, expenseAmountSchema } from '@/lib/schemas'
import { parseCurrencyToCents } from '@/lib/format'

// ---------------------------------------------------------------------------
// Recreate expenseFormSchema (not exported from the component module).
// Mirrors the schema defined in src/components/expense-form.tsx.
// ---------------------------------------------------------------------------

const expenseFormSchema = z
  .object({
    date: expenseDateSchema,
    merchant: expenseMerchantSchema,
    amount: z.string().transform(parseCurrencyToCents).pipe(expenseAmountSchema),
    categoryId: z.union([z.string(), z.null()]),
    newCategoryName: z.string().max(100, {
      message: 'Category name must be 100 characters or less.',
    }),
    comment: z.string().max(1000, {
      message: 'Comment must be 1000 characters or less.',
    }),
  })
  .refine((data) => data.categoryId !== null || data.newCategoryName.trim().length > 0, {
    message: 'Select or create a category.',
    path: ['categoryId'],
  })

// ---------------------------------------------------------------------------
// Schema test helpers (same pattern as schemas.test.ts)
// ---------------------------------------------------------------------------

type SafeParsable = {
  safeParse: (v: unknown) => {
    success: boolean
    data?: unknown
    error?: { issues: Array<{ message: string; path: (string | number)[] }> }
  }
}

function expectSuccess(schema: SafeParsable, value: unknown) {
  const result = schema.safeParse(value)
  expect(result.success).toBe(true)
  return result
}

function expectFailure(schema: SafeParsable, value: unknown) {
  const result = schema.safeParse(value)
  expect(result.success).toBe(false)
  return result
}

function getErrorMessages(schema: SafeParsable, value: unknown): string[] {
  const result = schema.safeParse(value)
  if (result.success) return []
  return result.error!.issues.map((i) => i.message)
}

// ---------------------------------------------------------------------------
// 1. Schema validation (pure logic — no component rendering)
// ---------------------------------------------------------------------------

describe('expenseFormSchema', () => {
  const validInput = {
    date: '2026-03-15',
    merchant: 'Coffee Shop',
    amount: '12.50',
    categoryId: 'cat-123',
    newCategoryName: '',
    comment: '',
  }

  describe('valid inputs', () => {
    it('accepts valid input with existing category', () => {
      expectSuccess(expenseFormSchema, validInput)
    })

    it('accepts valid input with new category name instead of categoryId', () => {
      expectSuccess(expenseFormSchema, {
        ...validInput,
        categoryId: null,
        newCategoryName: 'New Category',
      })
    })

    it('accepts comma-formatted amount (European style)', () => {
      expectSuccess(expenseFormSchema, { ...validInput, amount: '12,50' })
    })

    it('accepts empty comment', () => {
      expectSuccess(expenseFormSchema, { ...validInput, comment: '' })
    })

    it('accepts comment at boundary (1000 chars)', () => {
      expectSuccess(expenseFormSchema, { ...validInput, comment: 'A'.repeat(1000) })
    })

    it('accepts newCategoryName at boundary (100 chars)', () => {
      expectSuccess(expenseFormSchema, {
        ...validInput,
        categoryId: null,
        newCategoryName: 'A'.repeat(100),
      })
    })
  })

  describe('transforms', () => {
    it('transforms amount string to cents', () => {
      const result = expenseFormSchema.safeParse(validInput)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.amount).toBe(1250)
      }
    })

    it('transforms comma amount to cents', () => {
      const result = expenseFormSchema.safeParse({ ...validInput, amount: '9,99' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.amount).toBe(999)
      }
    })

    it('trims merchant whitespace', () => {
      const result = expenseFormSchema.safeParse({
        ...validInput,
        merchant: '  Coffee Shop  ',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.merchant).toBe('Coffee Shop')
      }
    })
  })

  describe('invalid inputs', () => {
    it('rejects invalid date', () => {
      const messages = getErrorMessages(expenseFormSchema, { ...validInput, date: 'bad' })
      expect(messages).toContain('Invalid date. Expected a valid YYYY-MM-DD date.')
    })

    it('rejects impossible calendar date', () => {
      expectFailure(expenseFormSchema, { ...validInput, date: '2026-02-30' })
    })

    it('rejects empty merchant', () => {
      const messages = getErrorMessages(expenseFormSchema, { ...validInput, merchant: '' })
      expect(messages).toContain('Merchant name is required.')
    })

    it('rejects whitespace-only merchant', () => {
      const messages = getErrorMessages(expenseFormSchema, { ...validInput, merchant: '   ' })
      expect(messages).toContain('Merchant name is required.')
    })

    it('rejects zero amount', () => {
      const messages = getErrorMessages(expenseFormSchema, { ...validInput, amount: '0' })
      expect(messages.some((m) => m.includes('positive'))).toBe(true)
    })

    it('rejects non-numeric amount', () => {
      const messages = getErrorMessages(expenseFormSchema, { ...validInput, amount: 'abc' })
      expect(messages.some((m) => m.includes('positive'))).toBe(true)
    })

    it('rejects comment over 1000 characters', () => {
      const messages = getErrorMessages(expenseFormSchema, {
        ...validInput,
        comment: 'A'.repeat(1001),
      })
      expect(messages).toContain('Comment must be 1000 characters or less.')
    })

    it('rejects newCategoryName over 100 characters', () => {
      const messages = getErrorMessages(expenseFormSchema, {
        ...validInput,
        categoryId: null,
        newCategoryName: 'A'.repeat(101),
      })
      expect(messages).toContain('Category name must be 100 characters or less.')
    })
  })

  describe('cross-field category validation (refine)', () => {
    it('fails when categoryId is null and newCategoryName is empty', () => {
      const messages = getErrorMessages(expenseFormSchema, {
        ...validInput,
        categoryId: null,
        newCategoryName: '',
      })
      expect(messages).toContain('Select or create a category.')
    })

    it('fails when categoryId is null and newCategoryName is whitespace-only', () => {
      const messages = getErrorMessages(expenseFormSchema, {
        ...validInput,
        categoryId: null,
        newCategoryName: '   ',
      })
      expect(messages).toContain('Select or create a category.')
    })

    it('passes when categoryId is set (newCategoryName can be empty)', () => {
      expectSuccess(expenseFormSchema, {
        ...validInput,
        categoryId: 'cat-123',
        newCategoryName: '',
      })
    })

    it('passes when newCategoryName is provided and categoryId is null', () => {
      expectSuccess(expenseFormSchema, {
        ...validInput,
        categoryId: null,
        newCategoryName: 'Groceries',
      })
    })

    it('assigns refine error to the categoryId path', () => {
      const result = expenseFormSchema.safeParse({
        ...validInput,
        categoryId: null,
        newCategoryName: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const categoryError = result.error.issues.find((i) => i.path.includes('categoryId'))
        expect(categoryError).toBeDefined()
        expect(categoryError!.message).toBe('Select or create a category.')
      }
    })
  })
})

// ---------------------------------------------------------------------------
// Mocks for component-level tests
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@tanstack/react-query', () => ({
  useSuspenseQuery: vi.fn(),
  useQuery: vi.fn(() => ({ data: null, isLoading: false })),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  })),
}))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: vi.fn((...args: unknown[]) => args),
  useConvexMutation: vi.fn(() => vi.fn()),
}))

vi.mock('../../convex/_generated/api', () => ({
  api: {
    categories: { list: 'categories.list' },
    expenses: {
      create: 'expenses.create',
      update: 'expenses.update',
      remove: 'expenses.remove',
      getMerchants: 'expenses.getMerchants',
      removeAttachment: 'expenses.removeAttachment',
    },
    storage: {
      generateUploadUrl: 'storage.generateUploadUrl',
      confirmUpload: 'storage.confirmUpload',
      getUrl: 'storage.getUrl',
    },
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { useSuspenseQuery } from '@tanstack/react-query'
import { ExpenseForm } from '@/components/expense-form'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockCategories = [
  { _id: 'cat1', name: 'Food', icon: '🍕', isPredefined: true },
  { _id: 'cat2', name: 'Transport', icon: '🚗', isPredefined: false },
]

const mockMerchants = ['Coffee Shop', 'Grocery Store', 'Gas Station']

const mockExpense = {
  _id: 'exp1',
  date: '2026-03-15',
  merchant: 'Coffee Shop',
  amount: 1250,
  categoryId: 'cat1',
  comment: 'Latte',
}

// ---------------------------------------------------------------------------
// 2. Component rendering tests
// ---------------------------------------------------------------------------

describe('ExpenseForm component', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(useSuspenseQuery).mockImplementation((queryOptions: unknown) => {
      const args = queryOptions as unknown[]
      if (args?.[0] === 'categories.list') {
        return { data: mockCategories } as ReturnType<typeof useSuspenseQuery>
      }
      if (args?.[0] === 'expenses.getMerchants') {
        return { data: mockMerchants } as ReturnType<typeof useSuspenseQuery>
      }
      return { data: null } as ReturnType<typeof useSuspenseQuery>
    })
  })

  describe('field labels', () => {
    it('renders all expected field labels', () => {
      render(<ExpenseForm mode="create" />)

      expect(screen.getByText('Date')).toBeDefined()
      expect(screen.getByText('Merchant')).toBeDefined()
      expect(screen.getByText('Category')).toBeDefined()
      expect(screen.getByText('Amount (EUR)')).toBeDefined()
      expect(screen.getByText('Attachment (optional)')).toBeDefined()
      expect(screen.getByText('Notes (optional)')).toBeDefined()
    })
  })

  describe('create mode', () => {
    it('shows "Create expense" submit button', () => {
      render(<ExpenseForm mode="create" />)

      expect(screen.getByRole('button', { name: 'Create expense' })).toBeDefined()
    })

    it('shows "Cancel" button', () => {
      render(<ExpenseForm mode="create" />)

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined()
    })

    it('does not show "Delete" button', () => {
      render(<ExpenseForm mode="create" />)

      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    })

    it('shows placeholder text for empty merchant combobox', () => {
      render(<ExpenseForm mode="create" />)

      expect(screen.getByText('Select or type...')).toBeDefined()
    })

    it('shows placeholder text for empty category combobox', () => {
      render(<ExpenseForm mode="create" />)

      expect(screen.getByText('Select category...')).toBeDefined()
    })

    it('renders the file input for attachment', () => {
      render(<ExpenseForm mode="create" />)

      const fileInput = document.querySelector('input[type="file"]')
      expect(fileInput).not.toBeNull()
    })

    it('shows attachment helper text', () => {
      render(<ExpenseForm mode="create" />)

      expect(screen.getByText('Images or PDF, maximum 10MB')).toBeDefined()
    })
  })

  describe('edit mode', () => {
    it('shows "Save changes" submit button', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render(<ExpenseForm mode="edit" expense={mockExpense as any} />)

      expect(screen.getByRole('button', { name: 'Save changes' })).toBeDefined()
    })

    it('shows "Delete" button', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render(<ExpenseForm mode="edit" expense={mockExpense as any} />)

      expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined()
    })

    it('pre-fills the merchant field with the expense merchant', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render(<ExpenseForm mode="edit" expense={mockExpense as any} />)

      expect(screen.getByText('Coffee Shop')).toBeDefined()
    })

    it('pre-fills the amount input', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render(<ExpenseForm mode="edit" expense={mockExpense as any} />)

      const amountInput = screen.getByPlaceholderText('0,00') as HTMLInputElement
      expect(amountInput.value).toBe('12.50')
    })

    it('pre-fills the comment input', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render(<ExpenseForm mode="edit" expense={mockExpense as any} />)

      const commentInput = screen.getByPlaceholderText('Add a note...') as HTMLInputElement
      expect(commentInput.value).toBe('Latte')
    })

    it('shows the selected category name', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render(<ExpenseForm mode="edit" expense={mockExpense as any} />)

      expect(screen.getByText('Food')).toBeDefined()
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Form interaction tests
  // ---------------------------------------------------------------------------

  describe('form interactions', () => {
    it('shows validation errors when submitting an empty form', async () => {
      render(<ExpenseForm mode="create" />)

      const submitButton = screen.getByRole('button', { name: 'Create expense' })
      fireEvent.click(submitButton)

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert')
        expect(alerts.length).toBeGreaterThan(0)
      })
    })

    it('displays merchant validation error on empty submit', async () => {
      render(<ExpenseForm mode="create" />)

      fireEvent.click(screen.getByRole('button', { name: 'Create expense' }))

      await waitFor(() => {
        expect(screen.getByText('Merchant name is required.')).toBeDefined()
      })
    })

    it('displays category validation error on empty submit', async () => {
      render(<ExpenseForm mode="create" />)

      fireEvent.click(screen.getByRole('button', { name: 'Create expense' }))

      await waitFor(() => {
        expect(screen.getByText('Select or create a category.')).toBeDefined()
      })
    })

    it('displays amount preview when typing a valid amount', () => {
      render(<ExpenseForm mode="create" />)

      const amountInput = screen.getByPlaceholderText('0,00')
      fireEvent.change(amountInput, { target: { value: '25.00' } })

      expect(screen.getByText('€25.00')).toBeDefined()
    })

    it('does not display amount preview for zero', () => {
      render(<ExpenseForm mode="create" />)

      const amountInput = screen.getByPlaceholderText('0,00')
      fireEvent.change(amountInput, { target: { value: '0' } })

      expect(screen.queryByText('€0.00')).toBeNull()
    })

    it('does not display amount preview for non-numeric input', () => {
      render(<ExpenseForm mode="create" />)

      const amountInput = screen.getByPlaceholderText('0,00')
      fireEvent.change(amountInput, { target: { value: 'abc' } })

      expect(screen.queryByText('€0.00')).toBeNull()
    })

    it('navigates to dashboard when Cancel is clicked', () => {
      render(<ExpenseForm mode="create" />)

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' })
    })
  })
})
