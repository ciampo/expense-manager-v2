import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { uploadReceipts, switchDashboardTab, completeDraft } from '../tests/shared/expenses'

test.describe('Draft expense workflow', () => {
  test.setTimeout(90_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('upload single file creates a draft visible in the Drafts tab', async ({ page }) => {
    await uploadReceipts(page, 1)

    await page.getByRole('link', { name: /go to dashboard/i }).click()
    await page.waitForURL('**/dashboard')

    await switchDashboardTab(page, 'Drafts')

    const table = page.getByRole('table', { name: /expenses/i })
    await expect(table.getByText('Draft')).toBeVisible()
    // Draft row shows placeholder dashes for unfilled fields
    await expect(table.getByRole('row').nth(1).getByText('—').first()).toBeVisible()
  })

  test('complete a draft moves it to the Complete tab', async ({ page }) => {
    await uploadReceipts(page, 1)
    await page.getByRole('link', { name: /go to dashboard/i }).click()
    await page.waitForURL('**/dashboard')

    await switchDashboardTab(page, 'Drafts')

    const table = page.getByRole('table', { name: /expenses/i })
    await table
      .getByRole('link', { name: /complete/i })
      .first()
      .click()
    await page.waitForURL(/\/expenses\//)

    await completeDraft(page, 'Draft Test Shop', '33,00', { day: 10 })

    // After completion, dashboard defaults to Complete tab
    await expect(page.getByText('Draft Test Shop')).toBeVisible()
    await expect(page.getByText('€33.00')).toBeVisible()

    // Drafts tab should be empty
    await switchDashboardTab(page, 'Drafts')
    await expect(page.getByText('No draft expenses')).toBeVisible()
  })

  test('delete a draft removes it from the Drafts tab', async ({ page }) => {
    await uploadReceipts(page, 1)
    await page.getByRole('link', { name: /go to dashboard/i }).click()
    await page.waitForURL('**/dashboard')

    await switchDashboardTab(page, 'Drafts')

    const table = page.getByRole('table', { name: /expenses/i })
    await expect(table.getByText('Draft')).toBeVisible()

    await table
      .getByRole('button', { name: /delete.*expense/i })
      .first()
      .click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Expense deleted')).toBeVisible()
    await expect(page.getByText('No draft expenses')).toBeVisible()
  })
})
