import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { createExpense } from '../tests/shared/expenses'
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
    await createExpense(page, 'Title Test', '10,00')

    await page.getByRole('link', { name: /edit/i }).first().click()
    await page.waitForURL(/\/expenses\//)

    await expect(page).toHaveTitle('Expense — Expense Manager')
  })
})
