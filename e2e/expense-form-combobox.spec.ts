import { test, expect } from '@playwright/test'

test.describe('Expense form — combobox UX', () => {
  const testPassword = 'TestPassword123!'

  test.setTimeout(45000)

  test.beforeEach(async ({ page }) => {
    const uniqueEmail = `combobox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10000 })

    await page.getByLabel('Email').fill(uniqueEmail)
    await page.getByLabel('Password', { exact: true }).fill(testPassword)
    await page.getByLabel('Confirm password').fill(testPassword)
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
    await page.goto('/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()
  })

  // ── Merchant combobox ──────────────────────────────────────

  test.describe('Merchant combobox', () => {
    test('shows "+ Use" option at the bottom when typed text has no exact match', async ({
      page,
    }) => {
      await page.getByRole('combobox', { name: /merchant/i }).click()
      const listbox = page.getByRole('listbox')
      await expect(listbox).toBeVisible()

      await page.getByPlaceholder(/search or create/i).fill('Brand New Shop')

      const useOption = listbox.getByRole('option', { name: /\+ Use "Brand New Shop"/ })
      await expect(useOption).toBeVisible()
    })

    test('"+ Use" option does not appear when input exactly matches an existing merchant', async ({
      page,
    }) => {
      // First, create an expense so we have a known merchant
      await page.getByRole('combobox', { name: /merchant/i }).click()
      await page.getByPlaceholder(/search or create/i).fill('TestMerchant')
      await page.getByRole('option', { name: /\+ Use "TestMerchant"/ }).click()

      // Fill out remaining required fields and submit
      await page.getByRole('combobox', { name: /category/i }).click()
      await page.getByRole('option', { name: /coworking/i }).click()
      await page.getByLabel(/amount/i).fill('10')
      await page.getByRole('button', { name: /create expense/i }).click()
      await page.waitForURL('**/dashboard', { timeout: 15000 })

      // Navigate to new expense — "TestMerchant" should now be listed
      await page.goto('/expenses/new')
      await page.getByRole('button', { name: /create expense/i }).waitFor()

      await page.getByRole('combobox', { name: /merchant/i }).click()
      await page.getByPlaceholder(/search or create/i).fill('TestMerchant')

      // The exact match exists, so "+ Use" should not appear
      const useOption = page.getByRole('option', { name: /\+ Use "TestMerchant"/ })
      await expect(useOption).not.toBeVisible()

      // But the existing merchant should be listed
      await expect(page.getByRole('option', { name: 'TestMerchant' })).toBeVisible()
    })

    test('selecting "+ Use" closes the popover and sets the merchant value', async ({ page }) => {
      const trigger = page.getByRole('combobox', { name: /merchant/i })
      await trigger.click()
      await page.getByPlaceholder(/search or create/i).fill('My New Merchant')
      await page.getByRole('option', { name: /\+ Use "My New Merchant"/ }).click()

      // Popover should be closed
      await expect(page.getByRole('listbox')).not.toBeVisible()

      // Trigger should display the merchant name
      await expect(trigger).toHaveText('My New Merchant')
    })

    test('shows "No merchants found" when no items match and no text entered', async ({ page }) => {
      await page.getByRole('combobox', { name: /merchant/i }).click()

      // A new user has no merchants — "No merchants found" should show
      // alongside the empty group (cmdk renders CommandEmpty when the
      // filtered list is empty).
      const emptyMsg = page.getByText('No merchants found')
      await expect(emptyMsg).toBeVisible()
    })
  })

  // ── Category combobox ──────────────────────────────────────

  test.describe('Category combobox', () => {
    test('shows "+ Use" option at the bottom when typed name has no exact match', async ({
      page,
    }) => {
      await page.getByRole('combobox', { name: /category/i }).click()
      const listbox = page.getByRole('listbox')
      await expect(listbox).toBeVisible()

      await page.getByPlaceholder(/search or create/i).fill('My Custom Category')

      const createOption = listbox.getByRole('option', {
        name: /\+ Use "My Custom Category"/,
      })
      await expect(createOption).toBeVisible()
    })

    test('"+ Use" option does not appear when input matches an existing category', async ({
      page,
    }) => {
      await page.getByRole('combobox', { name: /category/i }).click()
      // "Coworking" is a predefined category
      await page.getByPlaceholder(/search or create/i).fill('Coworking')

      const createOption = page.getByRole('option', { name: /\+ Use "Coworking"/ })
      await expect(createOption).not.toBeVisible()

      // But the existing category should still be visible
      await expect(page.getByRole('option', { name: /coworking/i })).toBeVisible()
    })

    test('selecting "+ Use" closes the popover without creating the category', async ({ page }) => {
      const trigger = page.getByRole('combobox', { name: /category/i })
      await trigger.click()
      await page.getByPlaceholder(/search or create/i).fill('Deferred Category')
      await page.getByRole('option', { name: /\+ Use "Deferred Category"/ }).click()

      // Popover should be closed
      await expect(page.getByRole('listbox')).not.toBeVisible()

      // Trigger shows the pending category name
      await expect(trigger).toHaveText('Deferred Category')

      // Re-open the combobox — the category should NOT appear in the
      // existing list (it hasn't been created yet)
      await trigger.click()
      const existingOption = page.getByRole('option', { name: 'Deferred Category', exact: true })
      await expect(existingOption).not.toBeVisible()
    })

    test('deferred category is created on form submission', async ({ page }) => {
      // Set up merchant
      await page.getByRole('combobox', { name: /merchant/i }).click()
      await page.getByPlaceholder(/search or create/i).fill('SomeShop')
      await page.getByRole('option', { name: /\+ Use "SomeShop"/ }).click()

      // Choose a new category via "+ Use"
      await page.getByRole('combobox', { name: /category/i }).click()
      await page.getByPlaceholder(/search or create/i).fill('Brand New Cat')
      await page.getByRole('option', { name: /\+ Use "Brand New Cat"/ }).click()

      // Fill amount
      await page.getByLabel(/amount/i).fill('25')

      // Submit the form
      await page.getByRole('button', { name: /create expense/i }).click()
      await page.waitForURL('**/dashboard', { timeout: 15000 })

      // Navigate to a new expense form — the category should now exist
      await page.goto('/expenses/new')
      await page.getByRole('button', { name: /create expense/i }).waitFor()

      await page.getByRole('combobox', { name: /category/i }).click()
      await expect(page.getByRole('option', { name: /brand new cat/i })).toBeVisible()
    })

    test('shows "No categories found" when search matches nothing', async ({ page }) => {
      await page.getByRole('combobox', { name: /category/i }).click()
      await page.getByPlaceholder(/search or create/i).fill('zzzzzznonexistent')

      await expect(page.getByText('No categories found')).toBeVisible()
    })
  })
})
