import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.setTimeout(45000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('hamburger menu is visible and desktop nav is hidden on mobile', async ({ page }) => {
    // Hamburger button should be visible
    const hamburger = page.getByRole('button', { name: 'Open menu' })
    await expect(hamburger).toBeVisible()

    // Desktop nav should exist in the DOM but be hidden on mobile (hidden md:flex).
    // Assert count first — toBeHidden() alone passes for missing elements,
    // which would be a false positive during the skeleton/pending state.
    const desktopNav = page.locator('header nav[aria-label="Main navigation"]')
    await expect(desktopNav).toHaveCount(1)
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
