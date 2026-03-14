import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'

test.describe('Settings page', () => {
  test.setTimeout(60000)

  test('navigates to settings and displays categories and merchants tables', async ({ page }) => {
    await signUpTestUser(page)

    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
    await expect(page.getByRole('table', { name: /categories/i })).toBeVisible()
    await expect(page.getByRole('table', { name: /merchants/i })).toBeVisible()
  })

  test('rename a category', async ({ page }) => {
    await signUpTestUser(page)

    // Create an expense with a custom category so we get a non-predefined one
    await page.getByRole('link', { name: /new expense/i }).click()
    await page.waitForURL('**/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()

    await page.getByRole('combobox', { name: /merchant/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('Settings Test Merchant')
    await page.getByRole('option', { name: /use "Settings Test Merchant"/i }).click()
    await expect(page.getByPlaceholder(/search or create/i)).toHaveCount(0)

    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('Rename Test Cat')
    await page.getByRole('option', { name: /use "Rename Test Cat"/i }).click()

    await page.getByLabel(/amount/i).fill('10,00')
    await page.getByRole('button', { name: /create expense/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    // Go to settings and rename the custom category
    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    const categoryRow = page.getByRole('row').filter({ hasText: 'Rename Test Cat' })
    await categoryRow.getByRole('button', { name: /rename/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const nameInput = dialog.getByLabel(/name/i)
    await nameInput.clear()
    await nameInput.fill('Renamed Category')
    await dialog.getByRole('button', { name: /save/i }).click()

    await expect(page.getByText('Renamed Category')).toBeVisible()
    await expect(page.getByText('Rename Test Cat')).not.toBeVisible()
  })

  test('rename a merchant and verify expense propagation', async ({ page }) => {
    await signUpTestUser(page)

    await page.getByRole('link', { name: /new expense/i }).click()
    await page.waitForURL('**/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()

    await page.getByRole('combobox', { name: /merchant/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('Old Merchant Name')
    await page.getByRole('option', { name: /use "Old Merchant Name"/i }).click()
    await expect(page.getByPlaceholder(/search or create/i)).toHaveCount(0)

    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByRole('option', { name: /coworking/i }).click()

    await page.getByLabel(/amount/i).fill('15,00')
    await page.getByRole('button', { name: /create expense/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    // Go to settings and rename the merchant
    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    const merchantRow = page.getByRole('row').filter({ hasText: 'Old Merchant Name' })
    await merchantRow.getByRole('button', { name: /rename/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const nameInput = dialog.getByLabel(/name/i)
    await nameInput.clear()
    await nameInput.fill('New Merchant Name')
    await dialog.getByRole('button', { name: /save/i }).click()

    await expect(page.getByText('New Merchant Name')).toBeVisible()
    await expect(page.getByText('Old Merchant Name')).not.toBeVisible()

    // Verify the expense on the dashboard reflects the new merchant name
    await page.getByRole('link', { name: /dashboard/i }).click()
    await page.waitForURL('**/dashboard')
    await expect(page.getByText('New Merchant Name')).toBeVisible()
  })

  test('delete an orphaned category', async ({ page }) => {
    await signUpTestUser(page)

    // Create an expense with a custom category, then delete the expense
    await page.getByRole('link', { name: /new expense/i }).click()
    await page.waitForURL('**/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()

    await page.getByRole('combobox', { name: /merchant/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('Orphan Test Merchant')
    await page.getByRole('option', { name: /use "Orphan Test Merchant"/i }).click()
    await expect(page.getByPlaceholder(/search or create/i)).toHaveCount(0)

    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('Orphan Category')
    await page.getByRole('option', { name: /use "Orphan Category"/i }).click()

    await page.getByLabel(/amount/i).fill('5,00')
    await page.getByRole('button', { name: /create expense/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    // Delete the expense so the category becomes orphaned
    await page.getByRole('button', { name: 'Delete' }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Orphan Test Merchant')).not.toBeVisible()

    // Go to settings and delete the orphaned category
    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    const categoryRow = page.getByRole('row').filter({ hasText: 'Orphan Category' })
    await categoryRow.getByRole('button', { name: /delete/i }).click()

    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /delete/i })
      .click()

    await expect(page.getByText('Orphan Category')).not.toBeVisible()
  })

  test('cannot delete a category that is referenced by expenses', async ({ page }) => {
    await signUpTestUser(page)

    // Create an expense with a custom category (keeping it referenced)
    await page.getByRole('link', { name: /new expense/i }).click()
    await page.waitForURL('**/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()

    await page.getByRole('combobox', { name: /merchant/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('Referenced Test Merchant')
    await page.getByRole('option', { name: /use "Referenced Test Merchant"/i }).click()
    await expect(page.getByPlaceholder(/search or create/i)).toHaveCount(0)

    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('Referenced Category')
    await page.getByRole('option', { name: /use "Referenced Category"/i }).click()

    await page.getByLabel(/amount/i).fill('20,00')
    await page.getByRole('button', { name: /create expense/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    // Go to settings — the delete button for the referenced category should be disabled
    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    const categoryRow = page.getByRole('row').filter({ hasText: 'Referenced Category' })
    const deleteButton = categoryRow.getByRole('button', { name: /delete/i })
    await expect(deleteButton).toBeDisabled()
  })
})
