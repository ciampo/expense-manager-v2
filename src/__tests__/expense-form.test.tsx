import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expenseFormSchema } from '@/lib/schemas'

// ---------------------------------------------------------------------------
// Schema-level tests (pure validation, no mocking needed)
// ---------------------------------------------------------------------------

describe('expenseFormSchema', () => {
  const validData = {
    date: '2025-06-15',
    merchant: 'Coffee Shop',
    amount: '42,00',
    categoryId: 'some-category-id',
    newCategoryName: '',
    comment: '',
  }

  function expectSuccess(data: unknown) {
    const result = expenseFormSchema.safeParse(data)
    expect(result.success).toBe(true)
    return result
  }

  function expectFailure(data: unknown) {
    const result = expenseFormSchema.safeParse(data)
    expect(result.success).toBe(false)
    return result
  }

  function getIssuesForPath(data: unknown, path: string) {
    const result = expenseFormSchema.safeParse(data)
    if (result.success) return []
    return result.error.issues.filter((i) => i.path.includes(path))
  }

  // ---- Happy path ----

  it('accepts valid data with existing category', () => {
    expectSuccess(validData)
  })

  it('accepts valid data with a new category name', () => {
    expectSuccess({
      ...validData,
      categoryId: null,
      newCategoryName: 'New Category',
    })
  })

  it('accepts amount with dot separator', () => {
    expectSuccess({ ...validData, amount: '42.50' })
  })

  it('accepts amount with comma separator', () => {
    expectSuccess({ ...validData, amount: '42,50' })
  })

  it('accepts empty comment', () => {
    expectSuccess({ ...validData, comment: '' })
  })

  it('accepts comment with text', () => {
    expectSuccess({ ...validData, comment: 'Business lunch' })
  })

  // ---- Merchant validation ----

  it('rejects empty merchant', () => {
    const issues = getIssuesForPath({ ...validData, merchant: '' }, 'merchant')
    expect(issues.length).toBeGreaterThan(0)
  })

  it('rejects whitespace-only merchant', () => {
    const issues = getIssuesForPath({ ...validData, merchant: '   ' }, 'merchant')
    expect(issues.length).toBeGreaterThan(0)
  })

  it('trims merchant before length validation', () => {
    // 200 chars + surrounding whitespace = 202 raw chars, but 200 after trim
    expectSuccess({ ...validData, merchant: ` ${'A'.repeat(200)} ` })
  })

  it('rejects merchant longer than 200 chars', () => {
    expectFailure({ ...validData, merchant: 'A'.repeat(201) })
  })

  it('accepts merchant at exactly 200 chars', () => {
    expectSuccess({ ...validData, merchant: 'A'.repeat(200) })
  })

  // ---- Amount validation (transform/pipe: string → cents → expenseAmountSchema) ----

  it('rejects zero amount', () => {
    const issues = getIssuesForPath({ ...validData, amount: '0' }, 'amount')
    expect(issues.length).toBeGreaterThan(0)
  })

  it('rejects negative amount', () => {
    const issues = getIssuesForPath({ ...validData, amount: '-42.00' }, 'amount')
    expect(issues.length).toBeGreaterThan(0)
  })

  it('rejects empty amount', () => {
    expectFailure({ ...validData, amount: '' })
  })

  it('rejects non-numeric amount', () => {
    expectFailure({ ...validData, amount: 'abc' })
  })

  // ---- Date validation ----

  it('rejects invalid date format', () => {
    const issues = getIssuesForPath({ ...validData, date: '15/06/2025' }, 'date')
    expect(issues.length).toBeGreaterThan(0)
  })

  it('rejects impossible calendar date', () => {
    expectFailure({ ...validData, date: '2025-02-30' })
  })

  // ---- Category cross-field validation ----

  it('rejects when no category selected and no new category name', () => {
    const issues = getIssuesForPath(
      { ...validData, categoryId: null, newCategoryName: '' },
      'categoryId',
    )
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0].message).toBe('Select or create a category.')
  })

  it('rejects whitespace-only new category name when no category selected', () => {
    expectFailure({ ...validData, categoryId: null, newCategoryName: '   ' })
  })

  // ---- Max-length constraints ----

  it('rejects new category name longer than 100 chars', () => {
    expectFailure({
      ...validData,
      categoryId: null,
      newCategoryName: 'A'.repeat(101),
    })
  })

  it('accepts new category name at exactly 100 chars', () => {
    expectSuccess({
      ...validData,
      categoryId: null,
      newCategoryName: 'A'.repeat(100),
    })
  })

  it('rejects comment longer than 1000 chars', () => {
    expectFailure({ ...validData, comment: 'A'.repeat(1001) })
  })

  it('accepts comment at exactly 1000 chars', () => {
    expectSuccess({ ...validData, comment: 'A'.repeat(1000) })
  })
})

// ---------------------------------------------------------------------------
// Component rendering & interaction tests
// ---------------------------------------------------------------------------

const mockCategories = [
  { _id: 'cat1', name: 'Coworking', icon: '🏢', isPredefined: true },
  { _id: 'cat2', name: 'Lunch', icon: '🍝', isPredefined: true },
]
const mockMerchants = ['Coffee Shop', 'Restaurant']

const mockNavigate = vi.fn()
const mockMutateAsync = vi.fn().mockResolvedValue(undefined)

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: vi.fn((_fn: unknown, _args: unknown) => ({
    queryKey: ['mock'],
  })),
  useConvexMutation: vi.fn(() => vi.fn()),
}))

vi.mock('@tanstack/react-query', () => ({
  useSuspenseQuery: vi.fn(() => ({ data: [] })),
  useQuery: vi.fn(() => ({ data: null, isLoading: false })),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

async function setupQueryMocks() {
  const rq = await import('@tanstack/react-query')
  const useSuspenseQuery = rq.useSuspenseQuery as Mock
  useSuspenseQuery
    .mockReturnValueOnce({ data: mockCategories })
    .mockReturnValueOnce({ data: mockMerchants })
  return { useSuspenseQuery }
}

async function renderForm(mode: 'create' | 'edit' = 'create') {
  await setupQueryMocks()
  const { ExpenseForm } = await import('@/components/expense-form')

  const expense =
    mode === 'edit'
      ? {
          _id: 'exp1' as never,
          date: '2025-06-15',
          merchant: 'Test Merchant',
          amount: 4200,
          categoryId: 'cat1' as never,
          comment: 'Test comment',
        }
      : undefined

  return render(<ExpenseForm mode={mode} expense={expense} />)
}

describe('ExpenseForm component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---- Create mode ----

  it('renders create mode with correct labels and buttons', async () => {
    await renderForm('create')

    expect(screen.getByLabelText('Date')).toBeVisible()
    expect(screen.getByLabelText('Merchant')).toBeVisible()
    expect(screen.getByLabelText('Category')).toBeVisible()
    expect(screen.getByLabelText('Amount (EUR)')).toBeVisible()
    expect(screen.getByLabelText('Notes (optional)')).toBeVisible()
    expect(screen.getByLabelText('Attachment (optional)')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Create expense' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  it('does not show delete button in create mode', async () => {
    await renderForm('create')

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('renders date picker with today date (not placeholder)', async () => {
    await renderForm('create')

    const datePicker = screen.getByLabelText('Date')
    expect(datePicker).toHaveTextContent(/.+/)
    expect(datePicker).not.toHaveTextContent('Select date')
  })

  it('shows no validation errors before submission', async () => {
    await renderForm('create')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('has noValidate on the form element', async () => {
    await renderForm('create')

    expect(screen.getByRole('form', { name: 'Expense form' })).toHaveAttribute('novalidate')
  })

  // ---- Edit mode ----

  it('renders edit mode with save and delete buttons', async () => {
    await renderForm('edit')

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  it('renders edit mode with pre-filled merchant value', async () => {
    await renderForm('edit')

    expect(screen.getByRole('combobox', { name: 'Merchant' })).toHaveTextContent('Test Merchant')
  })

  it('renders edit mode with pre-filled amount value', async () => {
    await renderForm('edit')

    expect(screen.getByLabelText('Amount (EUR)')).toHaveValue('42.00')
  })

  it('renders edit mode with pre-filled comment value', async () => {
    await renderForm('edit')

    expect(screen.getByLabelText('Notes (optional)')).toHaveValue('Test comment')
  })

  // ---- User interactions ----

  it('updates amount input value when user types', async () => {
    const user = userEvent.setup()
    await renderForm('create')

    const amountInput = screen.getByLabelText('Amount (EUR)')
    await user.type(amountInput, '12,50')

    expect(amountInput).toHaveValue('12,50')
  })

  it('shows formatted currency preview when a valid amount is entered', async () => {
    const user = userEvent.setup()
    await renderForm('create')

    await user.type(screen.getByLabelText('Amount (EUR)'), '12.50')

    expect(screen.getByText('€12.50')).toBeVisible()
  })

  it('updates comment input value when user types', async () => {
    const user = userEvent.setup()
    await renderForm('create')

    const commentInput = screen.getByLabelText('Notes (optional)')
    await user.type(commentInput, 'Team dinner')

    expect(commentInput).toHaveValue('Team dinner')
  })

  it('clears and replaces comment value when user edits', async () => {
    const user = userEvent.setup()
    await renderForm('edit')

    const commentInput = screen.getByLabelText('Notes (optional)')
    expect(commentInput).toHaveValue('Test comment')

    await user.clear(commentInput)
    await user.type(commentInput, 'Updated note')

    expect(commentInput).toHaveValue('Updated note')
  })

  it('shows validation errors after submitting empty form fields', async () => {
    const user = userEvent.setup()
    await renderForm('create')

    await user.click(screen.getByRole('button', { name: 'Create expense' }))

    expect(screen.queryAllByRole('alert').length).toBeGreaterThan(0)
  })

  it('shows merchant and category errors but not date error on empty submit', async () => {
    const user = userEvent.setup()
    await renderForm('create')

    await user.click(screen.getByRole('button', { name: 'Create expense' }))

    expect(screen.getByText('Merchant name is required.')).toBeVisible()
    expect(screen.getByText('Select or create a category.')).toBeVisible()
    expect(screen.queryByText(/Invalid date/)).not.toBeInTheDocument()
  })
})
