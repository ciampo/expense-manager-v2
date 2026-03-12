import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../shared/auth'
import { createExpense } from '../shared/expenses'

test.describe('Visual Regression - Reports', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('empty state', async ({ page }) => {
    await page.goto('/reports')
    await page.getByRole('heading', { name: /reports/i }).waitFor()
    await page.getByText(/no expense data yet/i).waitFor()

    await expect(page).toHaveScreenshot('reports-empty.png', {
      fullPage: true,
      mask: [page.locator('footer')],
    })
  })

  test('with month data', async ({ page }) => {
    await createExpense(page, 'Report Test Shop', '125,50')
    await expect(page.getByText('Report Test Shop')).toBeVisible()

    await page.goto('/reports')
    await page.getByRole('heading', { name: /reports/i }).waitFor()
    await page.getByText(/total expenses/i).waitFor()

    await expect(page).toHaveScreenshot('reports-with-data.png', {
      fullPage: true,
      mask: [page.locator('footer'), page.getByRole('combobox', { name: /select month/i })],
    })
  })

  test('month selector', async ({ page }) => {
    await createExpense(page, 'Selector Test Shop', '50,00')

    await page.goto('/reports')
    await page.getByRole('heading', { name: /reports/i }).waitFor()
    await page.getByText(/total expenses/i).waitFor()

    await page.getByRole('combobox', { name: /select month/i }).click()
    await expect(page.getByRole('listbox')).toBeVisible()

    await expect(page).toHaveScreenshot('reports-month-selector.png', {
      fullPage: true,
      mask: [
        page.locator('footer'),
        page.getByRole('combobox', { name: /select month/i }),
        page.getByRole('option'),
      ],
    })
  })
})
