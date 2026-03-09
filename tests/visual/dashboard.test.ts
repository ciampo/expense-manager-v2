import { test, expect, type Page } from '@playwright/test'
import { signUpTestUser } from '../shared/auth'

test.describe('Visual Regression - Dashboard', () => {
  test.setTimeout(60_000)

  async function createExpense(page: Page, merchant: string, amount: string) {
    await page.getByRole('link', { name: /new expense/i }).click()
    await page.waitForURL('**/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()

    await page.getByRole('combobox', { name: /merchant/i }).click()
    await page.getByPlaceholder(/search or create/i).fill(merchant)
    await page.getByRole('option', { name: `+ Use "${merchant}"`, exact: true }).click()
    await expect(page.getByPlaceholder(/search or create/i)).toHaveCount(0)

    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByRole('option', { name: /coworking/i }).click()

    await page.getByLabel(/amount/i).fill(amount)

    await page.getByRole('button', { name: /create expense/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15000 })
  }

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('empty state', async ({ page }) => {
    await expect(page.getByText(/haven't recorded any expenses/i)).toBeVisible()
    await expect(page).toHaveScreenshot('dashboard-empty.png', {
      fullPage: true,
      mask: [page.locator('footer')],
    })
  })

  test('with an expense', async ({ page }) => {
    await createExpense(page, 'Visual Test Shop', '42,00')
    await expect(page.getByText('Visual Test Shop')).toBeVisible()

    await expect(page).toHaveScreenshot('dashboard-with-expense.png', {
      fullPage: true,
      mask: [page.locator('footer'), page.locator('table tbody td:first-child')],
    })
  })

  test('with pagination controls', async ({ page }) => {
    test.setTimeout(180_000)

    const EXPENSE_COUNT = 11
    for (let i = 1; i <= EXPENSE_COUNT; i++) {
      await createExpense(page, `Merchant ${i}`, `${i},00`)
    }

    await expect(page.getByText(`Merchant ${EXPENSE_COUNT}`)).toBeVisible()

    // Default page size is 25 — the server returns all 11 items in a single
    // page (isDone=true), so Previous/Next buttons don't appear yet. The
    // page-size selector is visible because 11 >= PAGINATION_THRESHOLD (10).
    await expect(page.getByRole('combobox', { name: /rows per page/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /previous/i })).toBeHidden()

    await expect(page).toHaveScreenshot('dashboard-pagination-selector-only.png', {
      fullPage: true,
      mask: [page.locator('footer'), page.locator('table tbody td:first-child')],
    })

    // Switch to 10 rows per page — now the server returns 10 items with
    // isDone=false, triggering the full pagination bar.
    await page.getByRole('combobox', { name: /rows per page/i }).click()
    await page.getByRole('option', { name: '10', exact: true }).click()

    await expect(page.getByText('Page 1')).toBeVisible()
    await expect(page.getByRole('button', { name: /next/i })).toBeEnabled()
    await expect(page.getByRole('button', { name: /previous/i })).toBeDisabled()

    await expect(page).toHaveScreenshot('dashboard-pagination-full.png', {
      fullPage: true,
      mask: [page.locator('footer'), page.locator('table tbody td:first-child')],
    })

    // Navigate to page 2 and verify.
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText('Page 2')).toBeVisible()
    await expect(page.getByRole('button', { name: /previous/i })).toBeEnabled()
    await expect(page.getByRole('button', { name: /next/i })).toBeDisabled()

    // Navigate back to page 1.
    await page.getByRole('button', { name: /previous/i }).click()
    await expect(page.getByText('Page 1')).toBeVisible()
    await expect(page.getByRole('button', { name: /next/i })).toBeEnabled()
  })

  test('delete confirmation dialog', async ({ page }) => {
    await createExpense(page, 'Delete Test', '10,00')

    await page.getByRole('button', { name: 'Delete Delete Test expense' }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()

    await expect(page).toHaveScreenshot('dashboard-delete-dialog.png', {
      fullPage: true,
      mask: [page.locator('footer'), page.locator('table tbody td:first-child')],
    })
  })
})
