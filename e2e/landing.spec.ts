import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('should display the landing page', async ({ page }) => {
    await page.goto('/')

    // Check main heading
    await expect(page.getByRole('heading', { level: 2 })).toContainText(
      'Manage your work expenses'
    )

    // Check navigation buttons in main content
    const main = page.getByRole('main')
    await expect(main.getByRole('link', { name: 'Start for free' })).toBeVisible()
    await expect(main.getByRole('link', { name: 'Sign In' })).toBeVisible()
  })

  test('should navigate to sign in page', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Sign In' }).first().click()

    await expect(page).toHaveURL('/sign-in')
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })

  test('should navigate to sign up page', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Sign Up' }).first().click()

    await expect(page).toHaveURL('/sign-up')
    await expect(page.getByRole('heading', { name: 'Sign Up' })).toBeVisible()
  })
})

test.describe('Authentication Flow', () => {
  test('sign up page should have all required fields', async ({ page }) => {
    await page.goto('/sign-up')

    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Confirm password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible()
  })

  test('sign in page should have forgot password link', async ({ page }) => {
    await page.goto('/sign-in')

    await expect(page.getByText('Forgot password?')).toBeVisible()
    await page.getByText('Forgot password?').click()

    await expect(page).toHaveURL('/forgot-password')
  })

  test('should show validation for empty form submission', async ({ page }) => {
    await page.goto('/sign-in')

    // Try to submit empty form
    await page.getByRole('button', { name: 'Sign In' }).click()

    // HTML5 validation should prevent submission
    const emailInput = page.getByLabel('Email')
    await expect(emailInput).toHaveAttribute('required')
  })
})
