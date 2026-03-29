import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'

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

    // The full key is shown exactly once in a status banner
    const keyBanner = page.getByRole('status')
    await expect(keyBanner).toBeVisible({ timeout: 10_000 })
    await expect(keyBanner.getByText(/copy this key now/i)).toBeVisible()

    // The raw key is displayed in a code element
    const rawKey = await keyBanner.locator('code').textContent()
    expect(rawKey).toBeTruthy()
    expect(rawKey!.length).toBeGreaterThan(16)
  })

  test('created key appears in the list with prefix, name, and dates', async ({ page }) => {
    await page.getByLabel(/key name/i).fill('List Check Key')
    await page.getByRole('button', { name: /generate/i }).click()

    await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 })

    // Dismiss the "copy this key" banner
    await page.getByRole('button', { name: /dismiss/i }).click()

    // Key should appear in the API Keys table
    const keysTable = page.getByRole('table', { name: /api keys/i })
    await expect(keysTable).toBeVisible()

    const keyRow = keysTable.getByRole('row').filter({ hasText: 'List Check Key' })
    await expect(keyRow).toBeVisible()

    // Prefix is shown (8-char prefix followed by "...")
    await expect(keyRow.locator('code')).toBeVisible()
    const prefix = await keyRow.locator('code').textContent()
    expect(prefix).toMatch(/^.{8}\.{3}$/)

    // Created date is shown
    await expect(keyRow.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).toBeVisible()

    // Last used should show "Never" for a brand new key
    await expect(keyRow.getByText('Never')).toBeVisible()
  })

  test('revokes a key and removes it from the list', async ({ page }) => {
    // Create a key first
    await page.getByLabel(/key name/i).fill('Revoke Me Key')
    await page.getByRole('button', { name: /generate/i }).click()
    await expect(page.getByRole('status')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /dismiss/i }).click()

    const keysTable = page.getByRole('table', { name: /api keys/i })
    const keyRow = keysTable.getByRole('row').filter({ hasText: 'Revoke Me Key' })
    await expect(keyRow).toBeVisible()

    // Revoke the key
    await keyRow.getByRole('button', { name: /revoke/i }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Revoke' }).click()

    await expect(page.getByText('API key revoked')).toBeVisible()
    await expect(keyRow).not.toBeVisible()
  })
})
