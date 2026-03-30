import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { CSV_HEADER, parseCsvLines } from '../tests/shared/csv'
import { createExpense, createExpenseWithAttachment } from '../tests/shared/expenses'

test.describe('Reports page', () => {
  test.describe('empty state', () => {
    test.beforeEach(async ({ page }) => {
      await signUpTestUser(page)
    })

    test('renders heading, subtitle, and empty-state message', async ({ page }) => {
      await page.goto('/reports')
      await page.getByRole('heading', { name: /reports/i }).waitFor()

      await expect(page.getByText('Generate monthly reports of your expenses')).toBeVisible()
      await expect(page.getByText('No expense data yet')).toBeVisible()
      await expect(page.getByText(/add some expenses to generate reports/i)).toBeVisible()
    })
  })

  test.describe('with a single expense', () => {
    test.setTimeout(60_000)

    test.beforeEach(async ({ page }) => {
      await signUpTestUser(page)
      await createExpense(page, 'Report Test Shop', '42,00')
    })

    test('month selector shows exactly one month option', async ({ page }) => {
      await page.goto('/reports')
      await page.getByText('Select month').waitFor()

      const selectTrigger = page.getByRole('combobox', { name: 'Select month' })
      await expect(selectTrigger).toBeVisible()

      await selectTrigger.click()

      const options = page.getByRole('option')
      await expect(options.first()).toBeVisible()
      expect(await options.count()).toBe(1)
      await expect(options.first()).toHaveText(/^[A-Z][a-z]+ \d{4}$/)
    })

    test('displays all three summary cards with correct values', async ({ page }) => {
      await page.goto('/reports')
      await page.getByText('Total expenses').waitFor()

      const totalCard = page.locator('[data-slot="card"]').filter({ hasText: 'Total expenses' })
      await expect(totalCard).toBeVisible()
      await expect(totalCard.getByText('€42.00')).toBeVisible()

      const countCard = page.locator('[data-slot="card"]').filter({ hasText: 'Number of expenses' })
      await expect(countCard).toBeVisible()
      await expect(countCard.getByText('1', { exact: true })).toBeVisible()

      const attachmentsCard = page.locator('[data-slot="card"]').filter({ hasText: /Attachments/ })
      await expect(attachmentsCard).toBeVisible()
      await expect(attachmentsCard.getByText('0', { exact: true })).toBeVisible()
    })

    test('shows category breakdown with name, count, and amount', async ({ page }) => {
      await page.goto('/reports')
      await page.getByText('Summary by category').waitFor()

      const categoryCard = page
        .locator('[data-slot="card"]')
        .filter({ hasText: 'Summary by category' })

      await expect(categoryCard.getByText('Expenses grouped by category')).toBeVisible()
      await expect(categoryCard.getByText('Coworking')).toBeVisible()
      await expect(categoryCard.getByText('1 expense')).toBeVisible()
      await expect(categoryCard.getByText('€42.00')).toBeVisible()
    })

    test('shows export section with CSV enabled and ZIP disabled', async ({ page }) => {
      await page.goto('/reports')

      const exportCard = page.locator('[data-slot="card"]').filter({ hasText: 'Export' })
      await exportCard.waitFor()

      await expect(exportCard.getByText('Download month data')).toBeVisible()

      const csvButton = page.getByRole('button', { name: /download csv/i })
      await expect(csvButton).toBeVisible()
      await expect(csvButton).toBeEnabled()

      const zipButton = page.getByRole('button', { name: /download attachments/i })
      await expect(zipButton).toBeVisible()
      await expect(zipButton).toBeDisabled()
    })

    test('CSV download has correct filename and structured content', async ({ page }) => {
      await page.goto('/reports')
      await page.getByText('Total expenses').waitFor()

      const csvButton = page.getByRole('button', { name: /download csv/i })
      const [download] = await Promise.all([page.waitForEvent('download'), csvButton.click()])

      expect(download.suggestedFilename()).toMatch(/^expenses-[A-Z][a-z]+\.csv$/)

      const filePath = await download.path()
      expect(filePath).toBeTruthy()
      const lines = parseCsvLines(filePath!)

      const italianMonth = download.suggestedFilename().replace(/^expenses-|\.csv$/g, '')
      expect(lines[0]).toBe(italianMonth)
      expect(lines[1]).toBe(CSV_HEADER)

      const dataFields = lines[2].split(',')
      expect(Number(dataFields[0])).toBeGreaterThanOrEqual(1)
      expect(Number(dataFields[0])).toBeLessThanOrEqual(31)
      expect(dataFields[1]).toBe('Coworking')
      expect(dataFields[7]).toBe('42.00')

      expect(lines).toHaveLength(3)
    })
  })

  test.describe('with multiple expenses across categories', () => {
    test.setTimeout(120_000)

    test.beforeEach(async ({ page }) => {
      await signUpTestUser(page)
      await createExpense(page, 'Office Space A', '50,00', { day: 15 })
      await createExpense(page, 'Business Lunch', '25,00', {
        category: 'Pranzo di lavoro',
        day: 15,
      })
      await createExpense(page, 'Office Space B', '30,00', { day: 15 })
    })

    test('summary cards reflect aggregated totals', async ({ page }) => {
      await page.goto('/reports')
      await page.getByText('Total expenses').waitFor()

      const totalCard = page.locator('[data-slot="card"]').filter({ hasText: 'Total expenses' })
      await expect(totalCard.getByText('€105.00')).toBeVisible()

      const countCard = page.locator('[data-slot="card"]').filter({ hasText: 'Number of expenses' })
      await expect(countCard.getByText('3', { exact: true })).toBeVisible()

      const attachmentsCard = page.locator('[data-slot="card"]').filter({ hasText: /Attachments/ })
      await expect(attachmentsCard.getByText('0', { exact: true })).toBeVisible()
    })

    test('category breakdown lists categories sorted by total descending', async ({ page }) => {
      await page.goto('/reports')
      await page.getByText('Summary by category').waitFor()

      const categoryCard = page
        .locator('[data-slot="card"]')
        .filter({ hasText: 'Summary by category' })

      await expect(categoryCard.getByText('Coworking')).toBeVisible()
      await expect(categoryCard.getByText('2 expenses')).toBeVisible()
      await expect(categoryCard.getByText('€80.00')).toBeVisible()

      await expect(categoryCard.getByText('Pranzo di lavoro')).toBeVisible()
      await expect(categoryCard.getByText('1 expense')).toBeVisible()
      await expect(categoryCard.getByText('€25.00')).toBeVisible()

      const cardText = await categoryCard.textContent()
      expect(cardText!.indexOf('Coworking')).toBeLessThan(cardText!.indexOf('Pranzo di lavoro'))
    })

    test('CSV groups expenses by day and category with correct amounts', async ({ page }) => {
      await page.goto('/reports')
      await page.getByText('Total expenses').waitFor()

      const csvButton = page.getByRole('button', { name: /download csv/i })
      const [download] = await Promise.all([page.waitForEvent('download'), csvButton.click()])

      const filePath = await download.path()
      expect(filePath).toBeTruthy()
      const lines = parseCsvLines(filePath!)

      const italianMonth = download.suggestedFilename().replace(/^expenses-|\.csv$/g, '')
      expect(lines[0]).toBe(italianMonth)
      expect(lines[1]).toBe(CSV_HEADER)

      const row1 = lines[2].split(',')
      const day = Number(row1[0])
      expect(day).toBeGreaterThanOrEqual(1)
      expect(day).toBeLessThanOrEqual(31)
      expect(row1[1]).toBe('Coworking')
      expect(row1[7]).toBe('80.00')

      const row2 = lines[3].split(',')
      expect(Number(row2[0])).toBe(day)
      expect(row2[1]).toBe('Pranzo di lavoro')
      expect(row2[7]).toBe('25.00')

      expect(lines).toHaveLength(4)
    })
  })

  test.describe('with an attachment', () => {
    test.setTimeout(90_000)

    test.beforeEach(async ({ page }) => {
      await signUpTestUser(page)
      await createExpenseWithAttachment(page, 'Zip Shop', '10,00')
    })

    test('attachments summary card reflects the attachment count', async ({ page }) => {
      await page.goto('/reports')
      await page.getByText('Total expenses').waitFor()

      const attachmentsCard = page.locator('[data-slot="card"]').filter({ hasText: /Attachments/ })
      await expect(attachmentsCard.getByText('1', { exact: true })).toBeVisible()
    })

    test('ZIP download button is enabled and produces correct filename', async ({ page }) => {
      await page.goto('/reports')
      await page.getByText('Total expenses').waitFor()

      const zipButton = page.getByRole('button', { name: /download attachments/i })
      await expect(zipButton).toBeVisible()
      await expect(zipButton).toBeEnabled()

      const [download] = await Promise.all([page.waitForEvent('download'), zipButton.click()])

      expect(download.suggestedFilename()).toMatch(/^attachments-[A-Z][a-z]+-\d{4}\.zip$/)
    })
  })
})
