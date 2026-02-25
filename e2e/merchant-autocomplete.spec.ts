import { test, expect, type Page } from '@playwright/test'

const TEST_PASSWORD = 'TestPassword123!'

async function signUp(page: Page) {
  const uniqueEmail = `merchant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

  await page.goto('/sign-up')
  await page.getByRole('heading', { name: /sign up/i }).waitFor()
  await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10000 })

  await page.getByLabel('Email').fill(uniqueEmail)
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
  await page.getByLabel('Confirm password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign Up' }).click()

  await page.waitForURL('**/dashboard', { timeout: 15000 })
  await page.locator('header nav').waitFor()
}

async function createExpense(page: Page, merchantName: string) {
  await page.goto('/expenses/new')
  await page.getByRole('button', { name: /create expense/i }).waitFor()

  await page.locator('#merchant-combobox').click()
  await page.getByPlaceholder('Search or create...').fill(merchantName)
  await page.getByRole('button', { name: new RegExp(`Use "${merchantName}"`) }).click()

  await page.locator('#category-combobox').click()
  await page.getByRole('option', { name: /Coworking/ }).click()

  await page.locator('#amount').fill('10,00')

  await page.getByRole('button', { name: /create expense/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 15000 })
}

async function openMerchantCombobox(page: Page) {
  await page.goto('/expenses/new')
  await page.getByRole('button', { name: /create expense/i }).waitFor()
  await page.locator('#merchant-combobox').click()
}

test.describe('Merchant Autocomplete', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await signUp(page)
  })

  test('merchant from a created expense appears in the autocomplete list', async ({ page }) => {
    await createExpense(page, 'Alpha Market')

    await openMerchantCombobox(page)
    await expect(page.getByRole('option', { name: 'Alpha Market' })).toBeVisible()
  })

  test('merchants appear in alphabetical order without duplicates', async ({ page }) => {
    await createExpense(page, 'Zeta Restaurant')
    await createExpense(page, 'Alpha Market')
    await createExpense(page, 'Alpha Market')

    await openMerchantCombobox(page)

    await expect(page.getByRole('option', { name: 'Alpha Market' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Zeta Restaurant' })).toBeVisible()

    const allOptionTexts = await page.getByRole('option').allTextContents()
    const alphaIdx = allOptionTexts.indexOf('Alpha Market')
    const zetaIdx = allOptionTexts.indexOf('Zeta Restaurant')
    expect(alphaIdx).toBeGreaterThanOrEqual(0)
    expect(zetaIdx).toBeGreaterThanOrEqual(0)
    expect(alphaIdx).toBeLessThan(zetaIdx)

    // "Alpha Market" was used twice — verify it appears exactly once (dedup)
    const alphaCount = allOptionTexts.filter((t) => t === 'Alpha Market').length
    expect(alphaCount).toBe(1)
  })

  test('updating an expense merchant upserts the new name into autocomplete', async ({ page }) => {
    await createExpense(page, 'Alpha Market')

    // Navigate to the expense and edit it
    await page.getByRole('link', { name: 'Edit' }).click()
    await page.getByRole('heading', { name: /edit expense/i }).waitFor()

    // Change merchant
    await page.locator('#merchant-combobox').click()
    await page.getByPlaceholder('Search or create...').fill('Beta Deli')
    await page.getByRole('button', { name: /Use "Beta Deli"/ }).click()

    // Save
    await page.getByRole('button', { name: /save changes/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    // Verify both the old and new merchant appear in autocomplete
    await openMerchantCombobox(page)
    await expect(page.getByRole('option', { name: 'Alpha Market' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Beta Deli' })).toBeVisible()
  })
})
