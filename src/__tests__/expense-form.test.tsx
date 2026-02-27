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

  it('trims merchant before length validation', () => {
    expectSuccess({ ...validData, merchant: '  Cafe  ' })
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
// Component rendering tests
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

async function importMocks() {
  const rq = await import('@tanstack/react-query')
  return { useSuspenseQuery: rq.useSuspenseQuery as Mock }
}

describe('ExpenseForm component', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const { useSuspenseQuery } = await importMocks()
    useSuspenseQuery
      .mockReturnValueOnce({ data: mockCategories })
      .mockReturnValueOnce({ data: mockMerchants })
  })

  async function renderForm(mode: 'create' | 'edit' = 'create') {
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

  // ---- Create mode ----

  it('renders create mode with correct labels and buttons', async () => {
    await renderForm('create')

    expect(screen.getByLabelText('Date')).toBeTruthy()
    expect(screen.getByLabelText('Merchant')).toBeTruthy()
    expect(screen.getByLabelText('Category')).toBeTruthy()
    expect(screen.getByLabelText('Amount (EUR)')).toBeTruthy()
    expect(screen.getByLabelText('Notes (optional)')).toBeTruthy()
    expect(screen.getByLabelText('Attachment (optional)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create expense' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
  })

  it('does not show delete button in create mode', async () => {
    await renderForm('create')

    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('renders date picker with today date (not placeholder)', async () => {
    await renderForm('create')

    const datePicker = screen.getByLabelText('Date')
    expect(datePicker.textContent).toBeTruthy()
    expect(datePicker.textContent).not.toBe('Select date')
  })

  it('shows no validation errors before submission', async () => {
    await renderForm('create')

    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  it('has noValidate on the form element', async () => {
    const { container } = await renderForm('create')

    const form = container.querySelector('form')
    expect(form?.hasAttribute('novalidate')).toBe(true)
  })

  // ---- Edit mode ----

  it('renders edit mode with save and delete buttons', async () => {
    const { useSuspenseQuery } = await importMocks()
    useSuspenseQuery
      .mockReset()
      .mockReturnValueOnce({ data: mockCategories })
      .mockReturnValueOnce({ data: mockMerchants })

    await renderForm('edit')

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
  })

  it('renders edit mode with pre-filled merchant value', async () => {
    const { useSuspenseQuery } = await importMocks()
    useSuspenseQuery
      .mockReset()
      .mockReturnValueOnce({ data: mockCategories })
      .mockReturnValueOnce({ data: mockMerchants })

    await renderForm('edit')

    const merchantButton = screen.getByRole('combobox', { name: 'Merchant' })
    expect(merchantButton.textContent).toBe('Test Merchant')
  })

  it('renders edit mode with pre-filled amount value', async () => {
    const { useSuspenseQuery } = await importMocks()
    useSuspenseQuery
      .mockReset()
      .mockReturnValueOnce({ data: mockCategories })
      .mockReturnValueOnce({ data: mockMerchants })

    await renderForm('edit')

    const amountInput = screen.getByLabelText('Amount (EUR)') as HTMLInputElement
    expect(amountInput.value).toBe('42.00')
  })

  it('renders edit mode with pre-filled comment value', async () => {
    const { useSuspenseQuery } = await importMocks()
    useSuspenseQuery
      .mockReset()
      .mockReturnValueOnce({ data: mockCategories })
      .mockReturnValueOnce({ data: mockMerchants })

    await renderForm('edit')

    const commentInput = screen.getByLabelText('Notes (optional)') as HTMLInputElement
    expect(commentInput.value).toBe('Test comment')
  })

  // ---- Accessibility ----

  it('wraps each form field in a Field group with proper role', async () => {
    const { container } = await renderForm('create')

    const groups = container.querySelectorAll('[data-slot="field"]')
    // date, merchant, category, amount, comment = 5 Field-wrapped groups
    expect(groups.length).toBe(5)
  })

  it('uses FieldLabel (data-slot="field-label") for all labeled fields', async () => {
    const { container } = await renderForm('create')

    const fieldLabels = container.querySelectorAll('[data-slot="field-label"]')
    // date, merchant, category, amount, attachment, comment = 6 labels
    expect(fieldLabels.length).toBeGreaterThanOrEqual(5)
  })

  // ---- Form submission shows validation errors ----

  it('shows validation errors after submitting empty form fields', async () => {
    const user = userEvent.setup()
    const { useSuspenseQuery } = await importMocks()
    useSuspenseQuery
      .mockReset()
      .mockReturnValueOnce({ data: mockCategories })
      .mockReturnValueOnce({ data: mockMerchants })

    await renderForm('create')

    const submitButton = screen.getByRole('button', { name: 'Create expense' })
    await user.click(submitButton)

    const alerts = screen.queryAllByRole('alert')
    expect(alerts.length).toBeGreaterThan(0)
  })
})
