import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { waitForHydration } from '../tests/shared/page-readiness'

test.describe('Page titles — public routes', () => {
  test('landing page has default title', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)

    await expect(page).toHaveTitle('Expense Manager')
  })

  test('sign-in page has descriptive title', async ({ page }) => {
    await page.goto('/sign-in')
    await waitForHydration(page)

    await expect(page).toHaveTitle('Sign In — Expense Manager')
  })

  test('sign-up page has descriptive title', async ({ page }) => {
    await page.goto('/sign-up')
    await waitForHydration(page)

    await expect(page).toHaveTitle('Sign Up — Expense Manager')
  })

  test('forgot-password page has descriptive title', async ({ page }) => {
    await page.goto('/forgot-password')
    await waitForHydration(page)

    await expect(page).toHaveTitle('Reset Password — Expense Manager')
  })
})

test.describe('Page titles — authenticated routes', () => {
  test.setTimeout(45000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('dashboard has descriptive title', async ({ page }) => {
    await expect(page).toHaveTitle('Dashboard — Expense Manager')
  })

  test('reports page has descriptive title', async ({ page }) => {
    await page.getByRole('link', { name: /reports/i }).click()
    await page.waitForURL('**/reports')

    await expect(page).toHaveTitle('Reports — Expense Manager')
  })

  test('settings page has descriptive title', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click()
    await page.waitForURL('**/settings')

    await expect(page).toHaveTitle('Settings — Expense Manager')
  })

  test('new expense page has descriptive title', async ({ page }) => {
    await page.getByRole('link', { name: /new expense/i }).click()
    await page.waitForURL('**/expenses/new')

    await expect(page).toHaveTitle('New Expense — Expense Manager')
  })

  test('invalid expense ID shows in-layout 404', async ({ page }) => {
    await page.goto('/expenses/garbage')
    await page.getByRole('heading', { name: '404' }).waitFor()

    // Navigation stays visible (in-layout, not root full-page 404)
    await expect(page.getByRole('navigation')).toBeVisible()
    await expect(page.getByRole('link', { name: /back to dashboard/i })).toBeVisible()
  })

  test('edit expense page has descriptive title', async ({ page }) => {
    // Create an expense to navigate to
    await page.getByRole('link', { name: /new expense/i }).click()
    await page.waitForURL('**/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()

    await page.getByRole('combobox', { name: /merchant/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('Title Test')
    await page.getByRole('option', { name: '+ Use "Title Test"', exact: true }).click()
    await expect(page.getByPlaceholder(/search or create/i)).toHaveCount(0)

    await page.getByRole('combobox', { name: /category/i }).click()
    await page.getByRole('option', { name: /coworking/i }).click()

    await page.getByLabel(/amount/i).fill('10')
    await page.getByRole('button', { name: /create expense/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    // Navigate to the edit page
    await page.getByRole('link', { name: /edit/i }).first().click()
    await page.waitForURL(/\/expenses\//)

    await expect(page).toHaveTitle('Expense — Expense Manager')
  })
})
