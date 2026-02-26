import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../shared/auth'

test.describe('Visual Regression - Expense Form', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
    await page.goto('/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()
  })

  test('new expense form — default state', async ({ page }) => {
    await expect(page).toHaveScreenshot('expense-form-default.png', {
      fullPage: true,
      mask: [page.locator('footer'), page.locator('#date-picker')],
    })
  })

  test('new expense form — merchant combobox open with typed text', async ({ page }) => {
    await page.getByRole('combobox', { name: /merchant/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('New Shop')
    // Wait for the "+ Use" option to render
    await expect(page.getByRole('option', { name: '+ Use "New Shop"', exact: true })).toBeVisible()
    await expect(page).toHaveScreenshot('expense-form-merchant-combobox-new.png', {
      fullPage: true,
      mask: [page.locator('footer'), page.locator('#date-picker')],
    })
  })

  test('new expense form — category combobox open with typed text', async ({ page }) => {
    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('New Category')
    // Wait for the "+ Use" option to render
    await expect(
      page.getByRole('option', { name: '+ Use "New Category"', exact: true }),
    ).toBeVisible()
    await expect(page).toHaveScreenshot('expense-form-category-combobox-new.png', {
      fullPage: true,
      mask: [page.locator('footer'), page.locator('#date-picker')],
    })
  })

  test('new expense form — pending new category shown in trigger', async ({ page }) => {
    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('Pending Cat')
    await page.getByRole('option', { name: '+ Use "Pending Cat"', exact: true }).click()

    // Popover should be closed, trigger shows the pending name
    await expect(page.getByRole('listbox')).not.toBeVisible()
    await expect(page.getByRole('combobox', { name: /category/i })).toHaveText('Pending Cat')
    await expect(page).toHaveScreenshot('expense-form-category-pending.png', {
      fullPage: true,
      mask: [page.locator('footer'), page.locator('#date-picker')],
    })
  })
})
