import { test, expect, type Page } from '@playwright/test'

const TEST_PASSWORD = 'TestPassword123!'

async function signUpFreshUser(page: Page) {
  const uniqueEmail = `test-crud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`

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

test.describe('Expense CRUD', () => {
  test.setTimeout(60000)

  test('create, edit, and delete an expense', async ({ page }) => {
    await signUpFreshUser(page)

    // --- CREATE ---

    await page.getByRole('link', { name: /new expense/i }).click()
    await page.waitForURL('**/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()

    // Merchant
    await page.getByRole('combobox', { name: /merchant/i }).click()
    await page
      .getByPlaceholder(/search or create/i)
      .first()
      .fill('Test Merchant')
    await page.getByRole('option', { name: /\+ Use "Test Merchant"/ }).click()

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

    await page.waitForURL('**/dashboard', { timeout: 10000 })
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
    await page.waitForURL('**/dashboard', { timeout: 10000 })

    await expect(page.getByText('Test Merchant')).toBeVisible()
    await expect(page.getByText('€50.00')).toBeVisible()

    // --- DELETE ---

    await page.getByRole('button', { name: 'Delete' }).first().click()

    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Test Merchant')).not.toBeVisible()
    await expect(page.getByText(/haven't recorded any expenses/i)).toBeVisible()
  })
})
