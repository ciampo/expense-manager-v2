import { test, expect, type Page } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { TEST_PNG_BASE64, TEST_PDF } from '../tests/shared/fixtures'

async function navigateToNewExpense(page: Page) {
  await page.getByRole('link', { name: /new expense/i }).click()
  await page.waitForURL('**/expenses/new')
  await page.getByRole('button', { name: /create expense/i }).waitFor()
}

async function fillExpenseForm(page: Page, merchant: string) {
  await page.getByRole('combobox', { name: /merchant/i }).click()
  await page.getByPlaceholder(/search or create/i).fill(merchant)
  await page.getByRole('option', { name: `+ Use "${merchant}"`, exact: true }).click()
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
    await expect(page.getByText('Remove Attach Shop')).toBeVisible()

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

  test('replaces an existing attachment with a new one', async ({ page }) => {
    // Create expense with PNG
    await navigateToNewExpense(page)
    await fillExpenseForm(page, 'Replace Attach Shop')
    await uploadPngAttachment(page)
    await expect(page.getByText('File uploaded')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByAltText('Attachment preview')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /create expense/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15_000 })
    await expect(page.getByText('Replace Attach Shop')).toBeVisible()

    // Edit the expense
    await page.getByRole('link', { name: /edit/i }).first().click()
    await page.waitForURL(/\/expenses\//)
    await page.getByRole('button', { name: /save changes/i }).waitFor()
    await expect(page.getByAltText('Attachment preview')).toBeVisible({ timeout: 10_000 })

    // Remove existing PNG
    await page.getByRole('button', { name: /remove attachment/i }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByText('Attachment removed')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByAltText('Attachment preview')).not.toBeVisible()

    // Upload PDF
    await uploadPdfAttachment(page)
    await expect(page.getByText('File uploaded')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: /view attachment/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByAltText('Attachment preview')).not.toBeVisible()

    // Save and verify
    await page.getByRole('button', { name: /save changes/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15_000 })

    // Re-open edit to confirm PDF persisted
    await expect(page.getByText('Replace Attach Shop')).toBeVisible()
    await page.getByRole('link', { name: /edit/i }).first().click()
    await page.waitForURL(/\/expenses\//)
    await page.getByRole('button', { name: /save changes/i }).waitFor()
    await expect(page.getByRole('link', { name: /view attachment/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByAltText('Attachment preview')).not.toBeVisible()
  })
})
