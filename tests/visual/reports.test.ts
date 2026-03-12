import { test, expect, type Page } from '@playwright/test'
import { signUpTestUser } from '../shared/auth'

test.describe('Visual Regression - Reports', () => {
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
        page.getByRole('listbox'),
      ],
    })
  })
})
