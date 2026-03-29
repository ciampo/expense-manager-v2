import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import {
  createExpense,
  uploadReceipts,
  switchDashboardTab,
  completeDraft,
} from '../tests/shared/expenses'

const CSV_HEADER =
  'giorno,descrizione,aliquota,imponibile,imposta,imponibile,imposta,totale spese documentate'

function parseCsvLines(filePath: string): string[] {
  return readFileSync(filePath, 'utf-8')
    .replace(/^\uFEFF/, '')
    .split('\r\n')
    .filter(Boolean)
}

test.describe('Reports exclude draft expenses', () => {
  test.setTimeout(120_000)

  test('draft with date does not appear in report totals or CSV', async ({ page }) => {
    await signUpTestUser(page)

    // Create a real expense so the Reports page has data for this month
    await createExpense(page, 'Real Shop', '50,00', { day: 10 })

    // Upload a receipt to create a draft, then give it a date via "Save draft"
    await uploadReceipts(page, 1)
    await page.getByRole('link', { name: /go to dashboard/i }).click()
    await page.waitForURL('**/dashboard')

    await switchDashboardTab(page, 'Drafts')

    const table = page.getByRole('table', { name: /expenses/i })
    await table
      .getByRole('link', { name: /complete/i })
      .first()
      .click()
    await page.waitForURL(/\/expenses\//)

    // Partially fill the draft (set date + amount) and save as draft
    await page.getByRole('button', { name: /save as complete/i }).waitFor()
    await page.getByLabel(/amount/i).fill('99,00')
    await page.getByRole('button', { name: /save draft/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15_000 })

    // Reports should only reflect the real expense (€50.00)
    await page.goto('/reports')
    await page.getByText('Total expenses').waitFor()

    const totalCard = page.locator('[data-slot="card"]').filter({ hasText: 'Total expenses' })
    await expect(totalCard.getByText('€50.00')).toBeVisible()

    const countCard = page.locator('[data-slot="card"]').filter({ hasText: 'Number of expenses' })
    await expect(countCard.getByText('1', { exact: true })).toBeVisible()

    // CSV should contain only the real expense
    const csvButton = page.getByRole('button', { name: /download csv/i })
    const [download] = await Promise.all([page.waitForEvent('download'), csvButton.click()])
    const filePath = await download.path()
    expect(filePath).toBeTruthy()
    const lines = parseCsvLines(filePath!)
    expect(lines[1]).toBe(CSV_HEADER)
    // Only 3 lines: month title, header, one data row
    expect(lines).toHaveLength(3)
    expect(lines[2]).toContain('50.00')
  })

  test('completing a draft makes it appear in report totals', async ({ page }) => {
    await signUpTestUser(page)

    // Upload a receipt to create a draft
    await uploadReceipts(page, 1)
    await page.getByRole('link', { name: /go to dashboard/i }).click()
    await page.waitForURL('**/dashboard')

    // Reports should show no data (only a draft exists, no complete expenses)
    await page.goto('/reports')
    await page.getByRole('heading', { name: /reports/i }).waitFor()
    await expect(page.getByText('No expense data yet')).toBeVisible()

    // Complete the draft
    await page.goto('/dashboard')
    await page.getByRole('heading', { name: /dashboard/i }).waitFor()
    await switchDashboardTab(page, 'Drafts')

    const table = page.getByRole('table', { name: /expenses/i })
    await table
      .getByRole('link', { name: /complete/i })
      .first()
      .click()
    await page.waitForURL(/\/expenses\//)

    await completeDraft(page, 'Now Complete Shop', '75,00', { day: 15 })

    // Reports should now show the completed expense
    await page.goto('/reports')
    await page.getByText('Total expenses').waitFor()

    const totalCard = page.locator('[data-slot="card"]').filter({ hasText: 'Total expenses' })
    await expect(totalCard.getByText('€75.00')).toBeVisible()

    const countCard = page.locator('[data-slot="card"]').filter({ hasText: 'Number of expenses' })
    await expect(countCard.getByText('1', { exact: true })).toBeVisible()
  })
})
