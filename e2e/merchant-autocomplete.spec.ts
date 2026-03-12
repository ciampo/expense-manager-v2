import { test, expect, type Page } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { createExpense } from '../tests/shared/expenses'

/**
 * Select a merchant in an open combobox. Handles both new merchants
 * (the "+ Use" CommandItem) and existing ones — both render as
 * role="option", and the merchant name appears in the accessible name
 * of either variant, so a single locator covers both paths.
 */
async function selectMerchant(page: Page, merchantName: string) {
  await page.locator('#merchant-combobox').click()
  const input = page.getByPlaceholder('Search or create...')
  await expect(input).toBeVisible()
  await input.fill(merchantName)

  await page.getByRole('option', { name: merchantName }).first().click()
}

async function openMerchantCombobox(page: Page) {
  await page.goto('/expenses/new')
  await page.getByRole('button', { name: /create expense/i }).waitFor()
  await page.locator('#merchant-combobox').click()
}

test.describe('Merchant Autocomplete', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('merchant from a created expense appears in the autocomplete list', async ({ page }) => {
    await createExpense(page, 'Alpha Market', '10,00')

    await openMerchantCombobox(page)
    await expect(page.getByRole('option', { name: 'Alpha Market' })).toBeVisible()
  })

  test('merchants appear in alphabetical order without duplicates', async ({ page }) => {
    await createExpense(page, 'Zeta Restaurant', '10,00')
    await createExpense(page, 'Alpha Market', '10,00')
    await createExpense(page, 'Alpha Market', '10,00')

    await openMerchantCombobox(page)

    await expect(page.getByRole('option', { name: 'Alpha Market' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Zeta Restaurant' })).toBeVisible()

    const allOptionTexts = await page.getByRole('option').allTextContents()
    const alphaIdx = allOptionTexts.indexOf('Alpha Market')
    const zetaIdx = allOptionTexts.indexOf('Zeta Restaurant')
    expect(alphaIdx).toBeGreaterThanOrEqual(0)
    expect(zetaIdx).toBeGreaterThanOrEqual(0)
    expect(alphaIdx).toBeLessThan(zetaIdx)

    expect(allOptionTexts.filter((t) => t === 'Alpha Market').length).toBe(1)
  })

  test('autocomplete matches merchants case-insensitively', async ({ page }) => {
    await createExpense(page, 'Alpha Market', '10,00')

    await openMerchantCombobox(page)

    // Typing a different case should still surface the existing merchant
    await page.getByPlaceholder('Search or create...').fill('alpha market')
    await expect(page.getByRole('option', { name: 'Alpha Market' })).toBeVisible()

    // Only the original casing should appear
    const allOptionTexts = await page.getByRole('option').allTextContents()
    expect(allOptionTexts.filter((t) => t.toLowerCase() === 'alpha market').length).toBe(1)
    expect(allOptionTexts).toContain('Alpha Market')
  })

  test('updating an expense merchant upserts the new name into autocomplete', async ({ page }) => {
    await createExpense(page, 'Alpha Market', '10,00')

    await page.getByRole('link', { name: /edit/i }).click()
    await page.getByRole('heading', { name: /edit expense/i }).waitFor()

    // Wait for the expense data to populate the merchant combobox
    await expect(page.locator('#merchant-combobox')).toHaveText('Alpha Market')

    await selectMerchant(page, 'Beta Deli')

    await page.getByRole('button', { name: /save changes/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15_000 })

    await openMerchantCombobox(page)
    await expect(page.getByRole('option', { name: 'Alpha Market' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Beta Deli' })).toBeVisible()
  })
})
