import { expect, type Page } from '@playwright/test'

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
