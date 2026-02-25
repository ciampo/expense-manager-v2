import { test, expect } from '@playwright/test'

test.describe('Visual Regression - Expense Form', () => {
  const testPassword = 'TestPassword123!'

  test.setTimeout(45000)

  test.beforeEach(async ({ page }) => {
    const uniqueEmail = `visual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

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

  test('new expense form — default state', async ({ page }) => {
    await expect(page).toHaveScreenshot('expense-form-default.png', { fullPage: true })
  })

  test('new expense form — merchant combobox open with typed text', async ({ page }) => {
    await page.getByRole('combobox', { name: /merchant/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('New Shop')
    // Wait for the "+ Use" option to render
    await expect(page.getByRole('option', { name: /\+ Use "New Shop"/ })).toBeVisible()
    await expect(page).toHaveScreenshot('expense-form-merchant-combobox-new.png', {
      fullPage: true,
    })
  })

  test('new expense form — category combobox open with typed text', async ({ page }) => {
    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('New Category')
    // Wait for the "+ Use" option to render
    await expect(page.getByRole('option', { name: /\+ Use "New Category"/ })).toBeVisible()
    await expect(page).toHaveScreenshot('expense-form-category-combobox-new.png', {
      fullPage: true,
    })
  })

  test('new expense form — pending new category shown in trigger', async ({ page }) => {
    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('Pending Cat')
    await page.getByRole('option', { name: /\+ Use "Pending Cat"/ }).click()

    // Popover should be closed, trigger shows the pending name
    await expect(page.getByRole('listbox')).not.toBeVisible()
    await expect(page.getByRole('combobox', { name: /category/i })).toHaveText('Pending Cat')
    await expect(page).toHaveScreenshot('expense-form-category-pending.png', {
      fullPage: true,
    })
  })
})
