import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../shared/auth'
import { createExpense, createExpenseWithAttachment } from '../shared/expenses'

test.describe('Visual Regression - Dashboard', () => {
  test.setTimeout(60_000)

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

  test('with attachment indicator', async ({ page }) => {
    test.setTimeout(90_000)
    await createExpenseWithAttachment(page, 'Attached Shop', '42,00', { type: 'png' })
    await expect(page.getByText('Attached Shop')).toBeVisible()

    await expect(page).toHaveScreenshot('dashboard-with-attachment.png', {
      fullPage: true,
      mask: [page.locator('footer'), page.locator('table tbody td:first-child')],
    })
  })

  test('attachment hover card open', async ({ page }) => {
    test.setTimeout(90_000)
    await createExpenseWithAttachment(page, 'Hover Card Shop', '42,00', { type: 'png' })

    const trigger = page.getByRole('button', { name: /has attachment/i })
    await trigger.hover()

    const hoverCardLink = page.getByRole('link', { name: /view full/i })
    await expect(hoverCardLink).toBeVisible({ timeout: 10_000 })

    await expect(page).toHaveScreenshot('dashboard-hover-card-open.png', {
      fullPage: true,
      mask: [
        page.locator('footer'),
        page.locator('table tbody td:first-child'),
        page.getByAltText('Attachment preview'),
      ],
    })
  })
})
