import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { createExpense } from '../tests/shared/expenses'

test.describe('Settings page', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('navigates to settings and displays categories and merchants sections', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
    // Predefined categories are always present
    await expect(page.getByRole('table', { name: /categories/i })).toBeVisible()
    // Fresh user has no merchants
    await expect(page.getByText('No merchants found.')).toBeVisible()
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

  test('deleting last expense removes orphaned category and merchant from settings', async ({
    page,
  }) => {
    await createExpense(page, 'Ephemeral Merchant', '5,00', {
      category: 'Ephemeral Category',
    })

    // Delete the only expense — backend auto-cleans orphaned categories and merchants
    const expenseRow = page
      .getByRole('table', { name: /expenses/i })
      .getByRole('row')
      .filter({ hasText: 'Ephemeral Merchant' })
    await expenseRow.getByRole('button', { name: /delete.*expense/i }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Expense deleted')).toBeVisible()

    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    const categoriesTable = page.getByRole('table', { name: /categories/i })
    await expect(categoriesTable).toBeVisible()
    await expect(categoriesTable.getByText('Ephemeral Category')).not.toBeVisible()
    await expect(page.getByText('No merchants found.')).toBeVisible()
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
