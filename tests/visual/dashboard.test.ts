import { test, expect, type Page } from '@playwright/test'

const TEST_PASSWORD = 'TestPassword123!'

test.describe('Visual Regression - Dashboard', () => {
  test.setTimeout(60000)

  async function signUp(page: Page) {
    const uniqueEmail = `visual-dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10000 })

    await page.getByLabel('Email').fill(uniqueEmail)
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
    await page.getByLabel('Confirm password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign Up' }).click()

    try {
      await page.waitForURL('**/dashboard', { timeout: 15000 })
    } catch {
      const url = page.url()
      const bodyText = await page
        .locator('body')
        .innerText()
        .catch(() => 'could not read body')
      throw new Error(
        `Sign-up did not redirect to /dashboard. Stuck on: ${url}. Page: ${bodyText.slice(0, 500)}`,
      )
    }
    await page.locator('header nav').waitFor()
  }

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
    await page.waitForURL('**/dashboard', { timeout: 10000 })
  }

  test.beforeEach(async ({ page }) => {
    await signUp(page)
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

  test('delete confirmation dialog', async ({ page }) => {
    await createExpense(page, 'Delete Test', '10,00')

    await page.getByRole('button', { name: 'Delete' }).first().click()
    await expect(page.getByRole('alertdialog')).toBeVisible()

    await expect(page).toHaveScreenshot('dashboard-delete-dialog.png', {
      fullPage: true,
      mask: [page.locator('footer'), page.locator('table tbody td:first-child')],
    })
  })
})
