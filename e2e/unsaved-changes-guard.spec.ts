import { test, expect, type Page } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { createExpense } from '../tests/shared/expenses'

async function createExpenseAndNavigateToEdit(page: Page) {
  await createExpense(page, 'Guard Test', '10,00')

  await page.getByRole('link', { name: /edit/i }).first().click()
  await page.waitForURL(/\/expenses\//)
  await page.getByRole('button', { name: /save changes/i }).waitFor()
}

test.describe('Unsaved changes navigation guard', () => {
  test.setTimeout(60_000)

  test.describe('create form', () => {
    test.beforeEach(async ({ page }) => {
      await signUpTestUser(page)
      await page.goto('/expenses/new')
      await page.getByRole('button', { name: /create expense/i }).waitFor()
    })

    test('does not show dialog when navigating away from a clean form', async ({ page }) => {
      await page.getByRole('link', { name: /dashboard/i }).click()
      await page.waitForURL('**/dashboard')

      await expect(page.getByRole('alertdialog')).not.toBeVisible()
    })

    test('shows dialog when navigating away from a dirty form', async ({ page }) => {
      await page.getByLabel(/amount/i).fill('10')
      await expect(page.getByLabel(/amount/i)).toHaveValue('10')

      await page.getByRole('link', { name: /dashboard/i }).click()

      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('heading', { name: /unsaved changes/i })).toBeVisible()
    })

    test('"Stay on page" keeps the user on the form', async ({ page }) => {
      await page.getByLabel(/amount/i).fill('10')

      await page.getByRole('link', { name: /dashboard/i }).click()

      const dialog = page.getByRole('alertdialog')
      await dialog.getByRole('button', { name: /stay on page/i }).click()

      await expect(dialog).not.toBeVisible()
      expect(page.url()).toContain('/expenses/new')
      await expect(page.getByLabel(/amount/i)).toHaveValue('10')
    })

    test('"Leave page" navigates away and discards changes', async ({ page }) => {
      await page.getByLabel(/amount/i).fill('10')

      await page.getByRole('link', { name: /dashboard/i }).click()

      const dialog = page.getByRole('alertdialog')
      await dialog.getByRole('button', { name: /leave page/i }).click()

      await page.waitForURL('**/dashboard')
    })

    test('Cancel button triggers guard on a dirty form', async ({ page }) => {
      await page.getByLabel(/amount/i).fill('10')

      await page.getByRole('button', { name: /^cancel$/i }).click()

      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
    })

    test('Cancel button navigates directly when form is clean', async ({ page }) => {
      await page.getByRole('button', { name: /^cancel$/i }).click()

      await page.waitForURL('**/dashboard')
      await expect(page.getByRole('alertdialog')).not.toBeVisible()
    })
  })

  test.describe('edit form', () => {
    test.beforeEach(async ({ page }) => {
      await signUpTestUser(page)
      await createExpenseAndNavigateToEdit(page)
    })

    test('shows dialog when navigating away from a dirty edit form', async ({ page }) => {
      const amountInput = page.getByLabel(/amount/i)
      await amountInput.clear()
      await amountInput.fill('99')

      await page.getByRole('link', { name: /dashboard/i }).click()

      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('heading', { name: /unsaved changes/i })).toBeVisible()
    })

    test('does not show dialog when navigating away from a clean edit form', async ({ page }) => {
      await page.getByRole('link', { name: /dashboard/i }).click()
      await page.waitForURL('**/dashboard')

      await expect(page.getByRole('alertdialog')).not.toBeVisible()
    })
  })
})
