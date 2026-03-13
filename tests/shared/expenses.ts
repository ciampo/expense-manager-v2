import { expect, type Page } from '@playwright/test'

/** Minimal valid 1×1 pixel red PNG (67 bytes). */
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=='

/** Minimal valid PDF (%PDF-1.0 with one blank page). */
const TEST_PDF = `%PDF-1.0
1 0 obj<</Pages 2 0 R>>endobj
2 0 obj<</Kids[3 0 R]/Count 1>>endobj
3 0 obj<</MediaBox[0 0 612 792]>>endobj
trailer<</Root 1 0 R>>`

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Select a merchant in the combobox. Handles both new merchants (the
 * `+ Use "X"` create option) and previously used ones (plain `X`).
 */
async function selectMerchant(page: Page, merchant: string): Promise<void> {
  await page.getByRole('combobox', { name: /merchant/i }).click()
  await page.getByPlaceholder(/search or create/i).fill(merchant)
  const escaped = escapeRegExp(merchant)
  await page
    .getByRole('option', { name: new RegExp(`^(\\+ Use "${escaped}"|${escaped})$`) })
    .first()
    .click()
  await expect(page.getByPlaceholder(/search or create/i)).toHaveCount(0)
}

/**
 * Create an expense via the UI and wait for the redirect back to the dashboard.
 *
 * Picks "Coworking" as the category. Accepts `amount` in the locale-formatted
 * string the input expects (e.g. `'42,00'` for €42.00).
 */
export async function createExpense(page: Page, merchant: string, amount: string): Promise<void> {
  await page.goto('/expenses/new')
  await page.getByRole('button', { name: /create expense/i }).waitFor()

  await selectMerchant(page, merchant)

  await page.getByRole('combobox', { name: /category/i }).click()
  await page.getByRole('option', { name: /coworking/i }).click()

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

  await selectMerchant(page, merchant)

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
