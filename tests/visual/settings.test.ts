import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../shared/auth'
import { createExpense } from '../shared/expenses'

test.describe('Visual Regression - Settings', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('default state with predefined categories and no merchants', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('heading', { name: /settings/i }).waitFor()
    await page.getByText(/manage your categories, merchants, and API keys/i).waitFor()
    await page.getByText(/no merchants found/i).waitFor()

    await expect(page).toHaveScreenshot('settings-default.png', {
      fullPage: true,
      mask: [page.locator('footer')],
    })
  })

  test('with custom category and merchants', async ({ page }) => {
    test.setTimeout(90_000)

    await createExpense(page, 'Visual Merchant A', '10,00', { category: 'Custom Cat' })
    await createExpense(page, 'Visual Merchant B', '20,00')

    await page.goto('/settings')
    await page.getByRole('heading', { name: /settings/i }).waitFor()
    await page.getByText('Custom Cat').waitFor()
    await page.getByText('Visual Merchant A').waitFor()

    await expect(page).toHaveScreenshot('settings-with-data.png', {
      fullPage: true,
      mask: [page.locator('footer')],
    })
  })

  test('rename category dialog', async ({ page }) => {
    await createExpense(page, 'Rename Cat Shop', '10,00', { category: 'Temp Cat' })

    await page.goto('/settings')
    await page.getByRole('heading', { name: /settings/i }).waitFor()
    await page.getByText('Temp Cat').waitFor()
    await page.getByRole('table', { name: /merchants/i }).waitFor()

    await page.getByRole('button', { name: 'Rename Temp Cat' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await expect(page).toHaveScreenshot('settings-rename-category-dialog.png', {
      fullPage: true,
      mask: [page.locator('footer')],
    })
  })

  test('delete button disabled when category has expenses', async ({ page }) => {
    await createExpense(page, 'Del Cat Shop', '10,00', { category: 'Deletable Cat' })

    await page.goto('/settings')
    await page.getByRole('heading', { name: /settings/i }).waitFor()
    await page.getByRole('table', { name: /merchants/i }).waitFor()

    const disabledDeleteBtn = page
      .getByRole('table', { name: /categories/i })
      .getByRole('row')
      .filter({ hasText: 'Deletable Cat' })
      .getByRole('button', { name: /delete/i })
    await expect(disabledDeleteBtn).toBeDisabled()

    await expect(page).toHaveScreenshot('settings-delete-disabled.png', {
      fullPage: true,
      mask: [page.locator('footer')],
    })
  })

  test('rename merchant dialog', async ({ page }) => {
    await createExpense(page, 'Renamable Shop', '10,00')

    await page.goto('/settings')
    await page.getByRole('heading', { name: /settings/i }).waitFor()
    await page.getByText('Renamable Shop').waitFor()
    await page.getByRole('table', { name: /categories/i }).waitFor()

    await page.getByRole('button', { name: 'Rename Renamable Shop' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await expect(page).toHaveScreenshot('settings-rename-merchant-dialog.png', {
      fullPage: true,
      mask: [page.locator('footer')],
    })
  })
})
