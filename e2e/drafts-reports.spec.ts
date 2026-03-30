import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { CSV_HEADER, parseCsvLines } from '../tests/shared/csv'
import {
  createExpense,
  uploadReceipts,
  switchDashboardTab,
  completeDraft,
  selectCalendarDay,
} from '../tests/shared/expenses'

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

    // Partially fill the draft (set date + amount) and save as draft.
    // The date is required so the draft falls within the same month as
    // the real expense — without it, the draft would never appear in the
    // date-range query regardless of the isDraft filter.
    await page.getByRole('button', { name: /save as complete/i }).waitFor()
    await selectCalendarDay(page, 10)
    await page.getByLabel(/amount/i).fill('99,00')
    await page.getByRole('button', { name: /save draft/i }).click()
    await expect(page.getByText('Draft saved')).toBeVisible({ timeout: 15_000 })
    await page.waitForURL('**/dashboard')

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
