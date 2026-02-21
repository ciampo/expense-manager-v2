import { test, expect } from '@playwright/test'

async function signUpFreshUser(page: import('@playwright/test').Page) {
  const email = `test-crud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = 'TestPass123!'

  await page.goto('/sign-up')
  await page.getByRole('heading', { name: /sign up/i }).waitFor()
  await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10000 })

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Sign Up' }).click()

  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.locator('header nav').waitFor()

  return { email, password }
}

test.describe('Expense CRUD', () => {
  test('create, edit, and delete an expense', async ({ page }) => {
    await signUpFreshUser(page)

    // --- CREATE ---

    await page.getByRole('link', { name: /new expense/i }).click()
    await page.waitForURL('**/expenses/new')

    // Merchant
    await page.getByRole('combobox', { name: /merchant/i }).click()
    await page.getByPlaceholder(/search or create/i).first().fill('Test Merchant')
    await page.getByRole('button', { name: /use "test merchant"/i }).click()

    // Category — pick the first predefined one
    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByRole('option', { name: /coworking/i }).click()

    // Amount
    await page.getByLabel(/amount/i).fill('25.50')

    // Submit
    await page.getByRole('button', { name: /create expense/i }).click()

    await page.waitForURL('**/dashboard', { timeout: 10000 })
    await expect(page.getByText('Test Merchant')).toBeVisible()
    await expect(page.getByText('€25.50')).toBeVisible()

    // --- EDIT ---

    await page.getByRole('link', { name: 'Edit' }).first().click()
    await page.waitForURL(/\/expenses\//)

    const amountInput = page.getByLabel(/amount/i)
    await amountInput.clear()
    await amountInput.fill('50.00')

    await page.getByRole('button', { name: /save changes/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 10000 })

    await expect(page.getByText('€50.00')).toBeVisible()

    // --- DELETE ---

    await page.getByRole('button', { name: 'Delete' }).first().click()

    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete' })
      .click()

    await expect(page.getByText('Test Merchant')).not.toBeVisible()
    await expect(page.getByText(/haven't recorded any expenses/i)).toBeVisible()
  })
})
