import { test, expect, type Page } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'

/**
 * Generate an API key with the given name and dismiss the one-time
 * display banner so the key list is visible for assertions.
 */
async function createKeyAndDismiss(page: Page, name: string): Promise<void> {
  await page.getByLabel(/key name/i).fill(name)
  await page.getByRole('button', { name: /generate/i }).click()
  await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /dismiss/i }).click()
}

test.describe('API key management', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')
    await page.getByRole('heading', { name: /api keys/i }).waitFor()
  })

  test('creates a key and displays the full key once', async ({ page }) => {
    await page.getByLabel(/key name/i).fill('Test Key')
    await page.getByRole('button', { name: /generate/i }).click()

    const keyBanner = page.getByRole('status')
    await expect(keyBanner).toBeVisible({ timeout: 10_000 })
    await expect(keyBanner.getByText(/copy this key now/i)).toBeVisible()

    const rawKey = await keyBanner.locator('code').textContent()
    expect(rawKey).toBeTruthy()
    expect(rawKey!.length).toBeGreaterThan(16)

    await page.getByRole('button', { name: /dismiss/i }).click()
    await expect(keyBanner).not.toBeVisible()
  })

  test('created key appears in the list with prefix, name, and dates', async ({ page }) => {
    await createKeyAndDismiss(page, 'List Check Key')

    const keysTable = page.getByRole('table', { name: /api keys/i })
    await expect(keysTable).toBeVisible()

    const keyRow = keysTable.getByRole('row').filter({ hasText: 'List Check Key' })
    await expect(keyRow).toBeVisible()

    await expect(keyRow.locator('code')).toBeVisible()
    const prefix = await keyRow.locator('code').textContent()
    expect(prefix).toMatch(/^\w+\.{3}$/)

    const createdCell = keyRow.locator('td').nth(2)
    await expect(createdCell).not.toBeEmpty()
    await expect(createdCell).toContainText(/\d/)

    // Last used should show "Never" for a brand new key
    await expect(keyRow.getByText('Never')).toBeVisible()
  })

  test('revokes a key and removes it from the list', async ({ page }) => {
    await createKeyAndDismiss(page, 'Revoke Me Key')

    const keysTable = page.getByRole('table', { name: /api keys/i })
    const keyRow = keysTable.getByRole('row').filter({ hasText: 'Revoke Me Key' })
    await expect(keyRow).toBeVisible()

    await keyRow.getByRole('button', { name: /revoke/i }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Revoke' }).click()

    await expect(page.getByText('API key revoked')).toBeVisible()
    await expect(keyRow).not.toBeVisible()
  })
})
