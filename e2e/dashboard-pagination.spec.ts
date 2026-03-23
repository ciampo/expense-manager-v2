import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { createExpense } from '../tests/shared/expenses'

test.describe('Dashboard pagination', () => {
  test.setTimeout(180_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('auto-navigates back when last item on a later page is deleted', async ({ page }) => {
    const EXPENSE_COUNT = 11
    for (let i = 1; i <= EXPENSE_COUNT; i++) {
      await createExpense(page, `Auto-nav ${i}`, `${i},00`)
    }

    await expect(page.getByText(`Auto-nav ${EXPENSE_COUNT}`)).toBeVisible()

    // Switch to 10 rows/page so we get 2 pages (11 items / 10 per page).
    await page.getByRole('combobox', { name: /rows per page/i }).click()
    await page.getByRole('option', { name: '10', exact: true }).click()

    await expect(page.getByText('Page 1')).toBeVisible()
    await expect(page.getByRole('button', { name: /next/i })).toBeEnabled()

    // Navigate to page 2 — should show the single overflow item.
    await page.getByRole('button', { name: /next/i }).click()
    await expect(page.getByText('Page 2')).toBeVisible()

    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(1)

    // Delete the only item on page 2.
    await page
      .getByRole('button', { name: /delete/i })
      .first()
      .click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()

    // Should auto-navigate back to page 1 with "Next" disabled.
    await expect(page.getByText('Page 1')).toBeVisible()
    await expect(rows).toHaveCount(10)
    await expect(page.getByRole('button', { name: /next/i })).toBeDisabled()
  })
})
