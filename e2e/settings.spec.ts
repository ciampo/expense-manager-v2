import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { createExpense } from '../tests/shared/expenses'

test.describe('Settings page', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('navigates to settings and displays categories and merchants tables', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
    await expect(page.getByRole('table', { name: /categories/i })).toBeVisible()
    await expect(page.getByRole('table', { name: /merchants/i })).toBeVisible()
  })

  test('rename a category', async ({ page }) => {
    await createExpense(page, 'Settings Test Merchant', '10,00', {
      category: 'Rename Test Cat',
    })

    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    const categoriesTable = page.getByRole('table', { name: /categories/i })
    const categoryRow = categoriesTable.getByRole('row').filter({ hasText: 'Rename Test Cat' })
    await categoryRow.getByRole('button', { name: /rename/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const nameInput = dialog.getByLabel(/name/i)
    await nameInput.clear()
    await nameInput.fill('Renamed Category')
    await dialog.getByRole('button', { name: /save/i }).click()

    await expect(dialog).not.toBeVisible()
    await expect(page.getByText('Category renamed')).toBeVisible()
    await expect(categoriesTable.getByText('Renamed Category')).toBeVisible()
    await expect(categoriesTable.getByText('Rename Test Cat')).not.toBeVisible()
  })

  test('rename a merchant and verify expense propagation', async ({ page }) => {
    await createExpense(page, 'Old Merchant Name', '15,00')

    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    const merchantsTable = page.getByRole('table', { name: /merchants/i })
    const merchantRow = merchantsTable.getByRole('row').filter({ hasText: 'Old Merchant Name' })
    await merchantRow.getByRole('button', { name: /rename/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const nameInput = dialog.getByLabel(/name/i)
    await nameInput.clear()
    await nameInput.fill('New Merchant Name')
    await dialog.getByRole('button', { name: /save/i }).click()

    await expect(dialog).not.toBeVisible()
    await expect(page.getByText('Merchant renamed')).toBeVisible()
    await expect(merchantsTable.getByText('New Merchant Name')).toBeVisible()
    await expect(merchantsTable.getByText('Old Merchant Name')).not.toBeVisible()

    await page.getByRole('link', { name: /dashboard/i }).click()
    await page.waitForURL('**/dashboard')
    await expect(page.getByText('New Merchant Name')).toBeVisible()
  })

  test('delete an orphaned category', async ({ page }) => {
    await createExpense(page, 'Orphan Test Merchant', '5,00', {
      category: 'Orphan Category',
    })

    // Delete the expense so the category becomes orphaned
    const expenseRow = page
      .getByRole('table', { name: /expenses/i })
      .getByRole('row')
      .filter({ hasText: 'Orphan Test Merchant' })
    await expenseRow.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(expenseRow).not.toBeVisible()

    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    const categoriesTable = page.getByRole('table', { name: /categories/i })
    const categoryRow = categoriesTable.getByRole('row').filter({ hasText: 'Orphan Category' })
    await categoryRow.getByRole('button', { name: /delete/i }).click()

    const alertDialog = page.getByRole('alertdialog')
    await alertDialog.getByRole('button', { name: /delete/i }).click()

    await expect(alertDialog).not.toBeVisible()
    await expect(page.getByText('Category deleted')).toBeVisible()
    await expect(categoriesTable.getByText('Orphan Category')).not.toBeVisible()
  })

  test('delete an orphaned merchant', async ({ page }) => {
    await createExpense(page, 'Orphan Merchant', '5,00')

    // Delete the expense so the merchant becomes orphaned
    const expenseRow = page
      .getByRole('table', { name: /expenses/i })
      .getByRole('row')
      .filter({ hasText: 'Orphan Merchant' })
    await expenseRow.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(expenseRow).not.toBeVisible()

    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    const merchantsTable = page.getByRole('table', { name: /merchants/i })
    const merchantRow = merchantsTable.getByRole('row').filter({ hasText: 'Orphan Merchant' })
    await merchantRow.getByRole('button', { name: /delete/i }).click()

    const alertDialog = page.getByRole('alertdialog')
    await alertDialog.getByRole('button', { name: /delete/i }).click()

    await expect(alertDialog).not.toBeVisible()
    await expect(page.getByText('Merchant deleted')).toBeVisible()
    await expect(merchantsTable.getByText('Orphan Merchant')).not.toBeVisible()
  })

  test('cannot delete a category that is referenced by expenses', async ({ page }) => {
    await createExpense(page, 'Referenced Test Merchant', '20,00', {
      category: 'Referenced Category',
    })

    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    const categoriesTable = page.getByRole('table', { name: /categories/i })
    const categoryRow = categoriesTable.getByRole('row').filter({ hasText: 'Referenced Category' })
    await expect(categoryRow.getByRole('button', { name: /delete/i })).toBeDisabled()
  })

  test('cannot delete a merchant that is referenced by expenses', async ({ page }) => {
    await createExpense(page, 'Referenced Merchant', '20,00')

    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    const merchantsTable = page.getByRole('table', { name: /merchants/i })
    const merchantRow = merchantsTable.getByRole('row').filter({ hasText: 'Referenced Merchant' })
    await expect(merchantRow.getByRole('button', { name: /delete/i })).toBeDisabled()
  })
})
