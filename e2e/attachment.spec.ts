import { test, expect, type Page } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'

/** Minimal valid 1×1 pixel red PNG (67 bytes). */
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=='

/** Minimal valid PDF (%PDF-1.0 with one blank page). */
const TEST_PDF = `%PDF-1.0
1 0 obj<</Pages 2 0 R>>endobj
2 0 obj<</Kids[3 0 R]/Count 1>>endobj
3 0 obj<</MediaBox[0 0 612 792]>>endobj
trailer<</Root 1 0 R>>`

async function navigateToNewExpense(page: Page) {
  await page.getByRole('link', { name: /new expense/i }).click()
  await page.waitForURL('**/expenses/new')
  await page.getByRole('button', { name: /create expense/i }).waitFor()
}

async function fillExpenseForm(page: Page, merchant: string) {
  await page.getByRole('combobox', { name: /merchant/i }).click()
  await page.getByPlaceholder(/search or create/i).fill(merchant)
  await page.getByRole('option', { name: merchant }).first().click()
  await expect(page.getByPlaceholder(/search or create/i)).toHaveCount(0)

  await page.getByRole('combobox', { name: /category/i }).click()
  await page.getByRole('option', { name: /coworking/i }).click()

  await page.getByLabel(/amount/i).fill('15,00')
}

async function uploadPngAttachment(page: Page) {
  const fileInput = page.locator('#attachment-input')
  await fileInput.setInputFiles({
    name: 'test-receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TEST_PNG_BASE64, 'base64'),
  })
}

async function uploadPdfAttachment(page: Page) {
  const fileInput = page.locator('#attachment-input')
  await fileInput.setInputFiles({
    name: 'test-receipt.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(TEST_PDF),
  })
}

test.describe('Attachment upload and download', () => {
  test.setTimeout(90_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('uploads an attachment and sees the success toast', async ({ page }) => {
    await navigateToNewExpense(page)
    await uploadPngAttachment(page)

    await expect(page.getByText('File uploaded')).toBeVisible({ timeout: 15_000 })
  })

  test('shows attachment preview after upload', async ({ page }) => {
    await navigateToNewExpense(page)
    await uploadPngAttachment(page)

    await expect(page.getByText('File uploaded')).toBeVisible({ timeout: 15_000 })

    await expect(page.getByAltText('Attachment preview')).toBeVisible({ timeout: 10_000 })
  })

  test('saves expense with attachment and shows preview on edit', async ({ page }) => {
    await navigateToNewExpense(page)
    await fillExpenseForm(page, 'Attachment Shop')

    await uploadPngAttachment(page)
    await expect(page.getByText('File uploaded')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByAltText('Attachment preview')).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /create expense/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15_000 })

    await expect(page.getByText('Attachment Shop')).toBeVisible()

    await page.getByRole('link', { name: /edit/i }).first().click()
    await page.waitForURL(/\/expenses\//)
    await page.getByRole('button', { name: /save changes/i }).waitFor()

    await expect(page.getByAltText('Attachment preview')).toBeVisible({ timeout: 10_000 })
  })

  test('removes an attachment from a saved expense', async ({ page }) => {
    await navigateToNewExpense(page)
    await fillExpenseForm(page, 'Remove Attach Shop')

    await uploadPngAttachment(page)
    await expect(page.getByText('File uploaded')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: /create expense/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15_000 })

    await page.getByRole('link', { name: /edit/i }).first().click()
    await page.waitForURL(/\/expenses\//)
    await page.getByRole('button', { name: /save changes/i }).waitFor()

    await expect(page.getByAltText('Attachment preview')).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /remove attachment/i }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Remove' }).click()

    await expect(page.getByText('Attachment removed')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByAltText('Attachment preview')).not.toBeVisible()
  })

  test('removes an attachment before saving (unsaved expense)', async ({ page }) => {
    await navigateToNewExpense(page)
    await uploadPngAttachment(page)
    await expect(page.getByText('File uploaded')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByAltText('Attachment preview')).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /remove attachment/i }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Remove' }).click()

    await expect(page.getByAltText('Attachment preview')).not.toBeVisible()

    const fileInput = page.locator('#attachment-input')
    await expect(fileInput).toBeVisible()
  })

  test('uploads a PDF and shows the fallback "View attachment" link', async ({ page }) => {
    await navigateToNewExpense(page)
    await uploadPdfAttachment(page)

    await expect(page.getByText('File uploaded')).toBeVisible({ timeout: 15_000 })

    await expect(page.getByRole('link', { name: /view attachment/i })).toBeVisible({
      timeout: 15_000,
    })
  })
})
