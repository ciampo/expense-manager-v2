import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { createExpense, createExpenseWithAttachment } from '../tests/shared/expenses'

test.describe('Reports page', () => {
  test.setTimeout(60_000)

  test.describe('empty state', () => {
    test.beforeEach(async ({ page }) => {
      await signUpTestUser(page)
    })

    test('renders the reports heading and empty-state message', async ({ page }) => {
      await page.goto('/reports')
      await page.getByRole('heading', { name: /reports/i }).waitFor()

      await expect(page.getByText('No expense data yet')).toBeVisible()
      await expect(page.getByText(/add some expenses to generate reports/i)).toBeVisible()
    })
  })

  test.describe('with expense data', () => {
    test.beforeEach(async ({ page }) => {
      await signUpTestUser(page)
      await createExpense(page, 'Report Test Shop', '42,00')
    })

    test('shows the month selector and summary cards', async ({ page }) => {
      await page.goto('/reports')
      await page.getByRole('heading', { name: /reports/i }).waitFor()

      await expect(page.getByText('Select month')).toBeVisible()

      const totalCard = page.locator('[data-slot="card"]').filter({ hasText: 'Total expenses' })
      await expect(totalCard).toBeVisible()
      await expect(page.getByText('Number of expenses')).toBeVisible()
      await expect(totalCard.getByText('€42.00')).toBeVisible()
    })

    test('CSV download contains expected filename and content', async ({ page }) => {
      await page.goto('/reports')
      await page.getByText('Total expenses').waitFor()

      const csvButton = page.getByRole('button', { name: /download csv/i })
      await expect(csvButton).toBeVisible()
      await expect(csvButton).toBeEnabled()

      const [download] = await Promise.all([page.waitForEvent('download'), csvButton.click()])

      expect(download.suggestedFilename()).toMatch(/^expenses-.*\.csv$/)

      const filePath = await download.path()
      expect(filePath).toBeTruthy()
      const csv = readFileSync(filePath!, 'utf-8')
      expect(csv).toContain('Date')
      expect(csv).toContain('Coworking')
      expect(csv).toContain('42.00')
      expect(csv).toContain('TOTAL')
    })

    test('category breakdown shows the expense category', async ({ page }) => {
      await page.goto('/reports')
      await page.getByText('Summary by category').waitFor()

      await expect(page.getByText('Coworking')).toBeVisible()
    })

    test('month selector lists the current month', async ({ page }) => {
      await page.goto('/reports')
      await page.getByText('Select month').waitFor()

      const selectTrigger = page.getByRole('combobox', { name: 'Select month' })
      await expect(selectTrigger).toBeVisible()

      await selectTrigger.click()

      const options = page.getByRole('option')
      await expect(options.first()).toBeVisible()
      const count = await options.count()
      expect(count).toBeGreaterThanOrEqual(1)
    })
  })

  test.describe('month selector interaction', () => {
    test.setTimeout(90_000)

    test('opens the month selector and lists at least one option', async ({ page }) => {
      await signUpTestUser(page)

      await createExpense(page, 'Month Nav Shop', '20,00')

      await page.goto('/reports')
      const totalCard = page.locator('[data-slot="card"]').filter({ hasText: 'Total expenses' })
      await totalCard.waitFor()

      await expect(totalCard.getByText('€20.00')).toBeVisible()

      const selectTrigger = page.getByRole('combobox', { name: 'Select month' })
      await selectTrigger.click()

      const optionCount = await page.getByRole('option').count()
      expect(optionCount).toBeGreaterThanOrEqual(1)

      await page.keyboard.press('Escape')
    })
  })

  test.describe('ZIP download', () => {
    test.setTimeout(90_000)

    test('downloads a ZIP when an expense has an attachment', async ({ page }) => {
      await signUpTestUser(page)
      await createExpenseWithAttachment(page, 'Zip Shop', '10,00')

      await page.goto('/reports')
      await page.getByText('Total expenses').waitFor()

      const zipButton = page.getByRole('button', { name: /download attachments/i })
      await expect(zipButton).toBeVisible()
      await expect(zipButton).toBeEnabled()

      const [download] = await Promise.all([page.waitForEvent('download'), zipButton.click()])

      expect(download.suggestedFilename()).toMatch(/^attachments-.*\.zip$/)
    })
  })
})
