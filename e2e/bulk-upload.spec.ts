import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { uploadReceipts, switchDashboardTab, completeDraft } from '../tests/shared/expenses'

test.describe('Bulk upload', () => {
  test.setTimeout(120_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('upload multiple files creates drafts in the Drafts tab', async ({ page }) => {
    await uploadReceipts(page, 3)

    // Summary should reflect all drafts
    await expect(page.getByText(/3 drafts created/i)).toBeVisible()

    await page.getByRole('link', { name: /go to dashboard/i }).click()
    await page.waitForURL('**/dashboard')

    await switchDashboardTab(page, 'Drafts')

    const table = page.getByRole('table', { name: /expenses/i })
    const draftBadges = table.getByText('Draft', { exact: true })
    await expect(draftBadges).toHaveCount(3)
  })

  test('completing one draft moves only that one to Complete tab', async ({ page }) => {
    await uploadReceipts(page, 2)
    await page.getByRole('link', { name: /go to dashboard/i }).click()
    await page.waitForURL('**/dashboard')

    await switchDashboardTab(page, 'Drafts')

    const table = page.getByRole('table', { name: /expenses/i })
    await expect(table.getByText('Draft', { exact: true })).toHaveCount(2)

    // Complete the first draft
    await table
      .getByRole('link', { name: /complete/i })
      .first()
      .click()
    await page.waitForURL(/\/expenses\//)

    await completeDraft(page, 'Bulk Completed Shop', '55,00', { day: 12 })

    // Complete tab shows the completed expense
    await expect(page.getByText('Bulk Completed Shop')).toBeVisible()
    await expect(page.getByText('€55.00')).toBeVisible()

    // Drafts tab still has the remaining draft
    await switchDashboardTab(page, 'Drafts')
    const draftBadges = table.getByText('Draft', { exact: true })
    await expect(draftBadges).toHaveCount(1)
  })
})
