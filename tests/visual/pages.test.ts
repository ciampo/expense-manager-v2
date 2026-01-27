import { test, expect } from '@playwright/test'

test.describe('Visual Regression - Public Pages', () => {
  test('landing page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('landing-page.png', { fullPage: true })
  })

  test('sign in page', async ({ page }) => {
    await page.goto('/sign-in')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('sign-in-page.png', { fullPage: true })
  })

  test('sign up page', async ({ page }) => {
    await page.goto('/sign-up')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('sign-up-page.png', { fullPage: true })
  })

  test('forgot password page', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('forgot-password-page.png', { fullPage: true })
  })
})
