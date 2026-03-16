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
    await page.getByRole('option').first().click()
  }
  await expect(page.getByPlaceholder(/search or create/i)).toHaveCount(0)
}

/**
 * Create an expense via the UI and wait for the redirect back to the dashboard.
 *
 * Defaults to "Coworking" for the category. Pass `category` to create/select
 * a custom one instead. Accepts `amount` in the locale-formatted string the
 * input expects (e.g. `'42,00'` for €42.00).
 */
export async function createExpense(
  page: Page,
  merchant: string,
  amount: string,
  options?: { category?: string },
): Promise<void> {
  await page.goto('/expenses/new')
  await page.getByRole('button', { name: /create expense/i }).waitFor()

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
 * redirect back to the dashboard. Uses "Coworking" as the category.
 */
export async function createExpenseWithAttachment(
  page: Page,
  merchant: string,
  amount: string,
  options: { type: 'png' | 'pdf' } = { type: 'png' },
): Promise<void> {
  await page.goto('/expenses/new')
  await page.getByRole('button', { name: /create expense/i }).waitFor()

  await selectComboboxOption(page, /merchant/i, merchant)

  await page.getByRole('combobox', { name: /category/i }).click()
  await page.getByRole('option', { name: /coworking/i }).click()

  await page.getByLabel(/amount/i).fill(amount)

  const fileInput = page.locator('#attachment-input')
  if (options.type === 'png') {
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
