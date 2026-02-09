import { test, expect } from '@playwright/test'

test.describe('Mobile Navigation', () => {
  const testPassword = 'TestPass123!'

  // Mobile viewport — iPhone 13 dimensions
  test.use({ viewport: { width: 390, height: 844 } })

  // Allow extra time for sign-up + backend calls on CI
  test.setTimeout(45000)

  // Sign up a fresh user before each test
  test.beforeEach(async ({ page }) => {
    const uniqueEmail = `mobile-nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10000 })

    await page.getByLabel('Email').fill(uniqueEmail)
    await page.getByLabel('Password', { exact: true }).fill(testPassword)
    await page.getByLabel('Confirm password').fill(testPassword)
    await page.getByRole('button', { name: 'Sign Up' }).click()

    await page.waitForURL('**/dashboard', { timeout: 15000 })
  })

  test('hamburger menu is visible and desktop nav is hidden on mobile', async ({
    page,
  }) => {
    // Hamburger button should be visible
    const hamburger = page.getByRole('button', { name: 'Open menu' })
    await expect(hamburger).toBeVisible()

    // Desktop nav should be hidden (it has hidden md:flex)
    const desktopNav = page.locator('header nav[aria-label="Main"]')
    await expect(desktopNav).toBeHidden()
  })

  test('mobile menu opens and navigates correctly', async ({ page }) => {
    // Open hamburger menu
    await page.getByRole('button', { name: 'Open menu' }).click()

    // Dialog should appear with Menu title
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Menu')).toBeVisible()

    // Navigate to Reports
    await dialog.getByRole('link', { name: 'Reports' }).click()

    // Dialog should close and we should be on reports page
    await expect(dialog).toBeHidden()
    await page.waitForURL('**/reports')

    // Open menu again and navigate to Dashboard
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('dialog').getByRole('link', { name: 'Dashboard' }).click()

    await expect(page.getByRole('dialog')).toBeHidden()
    await page.waitForURL('**/dashboard')
  })

  test('mobile menu logout redirects to sign-in', async ({ page }) => {
    // Open hamburger menu
    await page.getByRole('button', { name: 'Open menu' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Click logout
    await dialog.getByRole('button', { name: 'Logout' }).click()

    // Should redirect to sign-in
    await page.waitForURL('**/sign-in', { timeout: 10000 })
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })
})
