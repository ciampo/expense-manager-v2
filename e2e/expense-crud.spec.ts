import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { createExpense } from '../tests/shared/expenses'

test.describe('Expense CRUD', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('creates an expense and displays it on the dashboard', async ({ page }) => {
    await createExpense(page, 'Test Merchant', '25,50')

    await expect(page.getByText('Test Merchant')).toBeVisible()
    await expect(page.getByText('€25.50')).toBeVisible()
  })

  test('edits an expense amount and reflects the change', async ({ page }) => {
    await createExpense(page, 'Edit Target', '25,50')

    await page
      .getByRole('table', { name: /expenses/i })
      .getByRole('link', { name: /edit.*expense/i })
      .first()
      .click()
    await page.waitForURL(/\/expenses\//)
    await page.getByRole('button', { name: /save changes/i }).waitFor()

    const amountInput = page.getByLabel(/amount/i)
    await amountInput.clear()
    await amountInput.fill('50,00')

    await page.getByRole('button', { name: /save changes/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15_000 })

    await expect(page.getByText('Edit Target')).toBeVisible()
    await expect(page.getByText('€50.00')).toBeVisible()
  })

  test('deletes an expense and shows empty state', async ({ page }) => {
    await createExpense(page, 'Delete Target', '10,00')

    const table = page.getByRole('table', { name: /expenses/i })
    await table
      .getByRole('button', { name: /delete.*expense/i })
      .first()
      .click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Expense deleted')).toBeVisible()
    await expect(page.getByText('Delete Target')).not.toBeVisible()
    await expect(page.getByText(/haven't recorded any expenses/i)).toBeVisible()
  })
})
