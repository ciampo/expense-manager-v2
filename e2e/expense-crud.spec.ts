import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'

test.describe('Expense CRUD', () => {
  test.setTimeout(60000)

  test('create, edit, and delete an expense', async ({ page }) => {
    await signUpTestUser(page)

    // --- CREATE ---

    await page.getByRole('link', { name: /new expense/i }).click()
    await page.waitForURL('**/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()

    // Merchant
    await page.getByRole('combobox', { name: /merchant/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('Test Merchant')
    await page.getByRole('option', { name: '+ Use "Test Merchant"', exact: true }).click()

    // Wait for the merchant popover to fully unmount (exit animation)
    // before opening the category popover.
    await expect(page.getByPlaceholder(/search or create/i)).toHaveCount(0)

    // Category — pick the first predefined one
    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByRole('option', { name: /coworking/i }).click()

    // Amount
    await page.getByLabel(/amount/i).fill('25,50')

    // Submit
    await page.getByRole('button', { name: /create expense/i }).click()

    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await expect(page.getByText('Test Merchant')).toBeVisible()
    await expect(page.getByText('€25.50')).toBeVisible()

    // --- EDIT ---

    await page.getByRole('link', { name: /edit/i }).first().click()
    await page.waitForURL(/\/expenses\//)
    await page.getByRole('button', { name: /save changes/i }).waitFor()

    const amountInput = page.getByLabel(/amount/i)
    await amountInput.clear()
    await amountInput.fill('50,00')

    await page.getByRole('button', { name: /save changes/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    await expect(page.getByText('Test Merchant')).toBeVisible()
    await expect(page.getByText('€50.00')).toBeVisible()

    // --- DELETE ---

    await page.getByRole('button', { name: 'Delete' }).first().click()

    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Test Merchant')).not.toBeVisible()
    await expect(page.getByText(/haven't recorded any expenses/i)).toBeVisible()
  })
})
