import { test, expect } from '@playwright/test'
import { waitForHydration } from '../shared/page-readiness'

test.describe('Visual Regression - Public Pages', () => {
  test('landing page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('heading', { name: /manage your work expenses/i }).waitFor()
    await expect(page).toHaveScreenshot('landing-page.png', {
      fullPage: true,
      mask: [page.getByRole('contentinfo')],
    })
  })

  test('sign in page', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByRole('heading', { name: /sign in/i }).waitFor()
    await waitForHydration(page)
    await expect(page).toHaveScreenshot('sign-in-page.png', {
      fullPage: true,
      mask: [page.getByRole('contentinfo')],
    })
  })

  test('sign up page', async ({ page }) => {
    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()
    await waitForHydration(page)
    await expect(page).toHaveScreenshot('sign-up-page.png', {
      fullPage: true,
      mask: [page.getByRole('contentinfo')],
    })
  })

  test('forgot password page', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByRole('heading', { name: /forgot password/i }).waitFor()
    await waitForHydration(page)
    await expect(page).toHaveScreenshot('forgot-password-page.png', {
      fullPage: true,
      mask: [page.getByRole('contentinfo')],
    })
  })
})
