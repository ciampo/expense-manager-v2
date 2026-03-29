import { expect, type Page } from '@playwright/test'
import { TEST_PNG_BASE64, TEST_PDF } from './fixtures'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Select an option in a combobox that supports both existing entries and
 * the `+ Use "X"` create option. Waits for the popover to close.
 *
 * Delegates all filtering/matching to the combobox UI itself — the
 * Command component filters by what's typed and shouldShowCreateOption
 * decides whether to show the create action. The helper just types,
 * waits for options, and clicks the right one.
 */
async function selectComboboxOption(
  page: Page,
  comboboxName: RegExp,
  value: string,
): Promise<void> {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('selectComboboxOption: value must be a non-empty string')
  await page.getByRole('combobox', { name: comboboxName }).click()
  await page.getByPlaceholder(/search or create/i).fill(trimmed)
  const escaped = escapeRegExp(trimmed)
  const createOption = page.getByRole('option', { name: new RegExp(`^\\+ Use "${escaped}"$`) })
  await page.getByRole('option').first().waitFor()
  if (await createOption.count()) {
    await createOption.click()
  } else {
    await page.getByRole('option', { name: trimmed }).first().click()
  }
  await expect(page.getByPlaceholder(/search or create/i)).toHaveCount(0)
}

/**
 * Open the date picker and select a specific day in the currently-displayed
 * month. If the day is already selected the picker is closed without changes.
 */
async function selectCalendarDay(page: Page, day: number): Promise<void> {
  await page.locator('#date-picker').click()
  const calendar = page.locator('[data-slot="calendar"]')
  await calendar.waitFor()

  const dayCell = calendar
    .locator('td:not([data-outside])')
    .filter({ hasText: new RegExp(`^${day}$`) })

  if ((await dayCell.getAttribute('data-selected')) === 'true') {
    await page.keyboard.press('Escape')
  } else {
    await dayCell.getByRole('button').click()
  }

  await expect(calendar).not.toBeVisible()
}

/**
 * Create an expense via the UI and wait for the redirect back to the dashboard.
 *
 * Defaults to "Coworking" for the category. Pass `category` to create/select
 * a custom one instead. Pass `day` (1–28) to pin the day-of-month via the
 * date picker, preventing flakiness when tests run near midnight. Accepts
 * `amount` in the locale-formatted string the input expects (e.g. `'42,00'`
 * for €42.00).
 */
export async function createExpense(
  page: Page,
  merchant: string,
  amount: string,
  options?: { category?: string; day?: number },
): Promise<void> {
  await page.goto('/expenses/new')
  await page.getByRole('button', { name: /create expense/i }).waitFor()

  if (options?.day) {
    await selectCalendarDay(page, options.day)
  }

  await selectComboboxOption(page, /merchant/i, merchant)

  if (options?.category) {
    await selectComboboxOption(page, /category/i, options.category)
  } else {
    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByRole('option', { name: /coworking/i }).click()
  }

  await page.getByLabel(/amount/i).fill(amount)

  await page.getByRole('button', { name: /create expense/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}

/**
 * Create an expense with a file attachment via the UI and wait for the
 * redirect back to the dashboard. Defaults to "Coworking" category;
 * pass `options.category` to create/select a different one. Pass `day`
 * (1–28) to pin the day-of-month via the date picker.
 */
export async function createExpenseWithAttachment(
  page: Page,
  merchant: string,
  amount: string,
  options: { type?: 'png' | 'pdf'; category?: string; day?: number } = {},
): Promise<void> {
  const { type = 'png', category, day } = options

  await page.goto('/expenses/new')
  await page.getByRole('button', { name: /create expense/i }).waitFor()

  if (day) {
    await selectCalendarDay(page, day)
  }

  await selectComboboxOption(page, /merchant/i, merchant)

  if (category) {
    await selectComboboxOption(page, /category/i, category)
  } else {
    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByRole('option', { name: /coworking/i }).click()
  }

  await page.getByLabel(/amount/i).fill(amount)

  const fileInput = page.locator('#attachment-input')
  if (type === 'png') {
    await fileInput.setInputFiles({
      name: 'test-receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from(TEST_PNG_BASE64, 'base64'),
    })
  } else {
    await fileInput.setInputFiles({
      name: 'test-receipt.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(TEST_PDF),
    })
  }

  await expect(page.getByText('File uploaded')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: /create expense/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}

/**
 * Upload one or more receipt files via the bulk upload page.
 * Waits until all uploads complete (the summary section appears).
 * Does NOT navigate away — the caller decides where to go next.
 */
export async function uploadReceipts(page: Page, count: number = 1): Promise<void> {
  await page.goto('/expenses/upload')
  await page.getByRole('heading', { name: /upload receipts/i }).waitFor()

  const files = Array.from({ length: count }, (_, i) => ({
    name: `receipt-${i + 1}.png`,
    mimeType: 'image/png' as const,
    buffer: Buffer.from(TEST_PNG_BASE64, 'base64'),
  }))

  const fileInput = page.getByLabel(/upload receipt files/i)
  await fileInput.setInputFiles(files)

  await expect(page.getByText(/draft.? created/i)).toBeVisible({ timeout: 30_000 })
}

/**
 * Switch to a specific filter tab on the dashboard (Complete / Drafts / All).
 */
export async function switchDashboardTab(
  page: Page,
  tab: 'Complete' | 'Drafts' | 'All',
): Promise<void> {
  const tabsList = page.getByRole('tablist', { name: /filter expenses by status/i })
  await tabsList.getByRole('tab', { name: new RegExp(tab, 'i') }).click()
}

/**
 * Complete a draft expense from the dashboard Drafts tab.
 *
 * Clicks "Complete" on the first (or specified) draft row, fills required
 * fields, and submits. Waits for the redirect back to the dashboard.
 */
export async function completeDraft(
  page: Page,
  merchant: string,
  amount: string,
  options?: { category?: string; day?: number },
): Promise<void> {
  await page.getByRole('button', { name: /save as complete/i }).waitFor()

  if (options?.day) {
    await selectCalendarDay(page, options.day)
  }

  await selectComboboxOption(page, /merchant/i, merchant)

  if (options?.category) {
    await selectComboboxOption(page, /category/i, options.category)
  } else {
    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByRole('option', { name: /coworking/i }).click()
  }

  await page.getByLabel(/amount/i).fill(amount)

  await page.getByRole('button', { name: /save as complete/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}
