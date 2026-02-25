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

  // Open merchant combobox, type a new name, and confirm
  await page.locator('#merchant-combobox').click()
  await page.getByPlaceholder('Search or create...').fill(merchantName)
  await page.getByRole('button', { name: new RegExp(`Use "${merchantName}"`) }).click()

  // Select predefined "Coworking" category
  await page.locator('#category-combobox').click()
  await page.getByRole('option', { name: /Coworking/ }).click()

  // Enter amount (EUR)
  await page.locator('#amount').fill('10,00')

  // Submit and wait for redirect
  await page.getByRole('button', { name: /create expense/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 15000 })
}

test.describe('Merchant Autocomplete', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await signUp(page)
  })

  test('merchant from a created expense appears in the autocomplete list', async ({ page }) => {
    await createExpense(page, 'Alpha Market')

    await page.goto('/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()

    await page.locator('#merchant-combobox').click()
    await expect(page.getByRole('option', { name: 'Alpha Market' })).toBeVisible()
  })

  test('merchants appear in alphabetical order', async ({ page }) => {
    await createExpense(page, 'Zeta Restaurant')
    await createExpense(page, 'Alpha Market')

    await page.goto('/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()

    await page.locator('#merchant-combobox').click()

    await expect(page.getByRole('option', { name: 'Alpha Market' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Zeta Restaurant' })).toBeVisible()

    const allOptionTexts = await page.getByRole('option').allTextContents()
    const alphaIdx = allOptionTexts.indexOf('Alpha Market')
    const zetaIdx = allOptionTexts.indexOf('Zeta Restaurant')
    expect(alphaIdx).toBeGreaterThanOrEqual(0)
    expect(zetaIdx).toBeGreaterThanOrEqual(0)
    expect(alphaIdx).toBeLessThan(zetaIdx)
  })
})
