import { test, expect } from '@playwright/test'

test.describe('Visual Regression - Auth Form Validation States', () => {
  test('sign-in page — validation errors', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByRole('heading', { name: /sign in/i }).waitFor()
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10000 })

    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText('Email is required.')).toBeVisible()

    await expect(page).toHaveScreenshot('sign-in-validation-errors.png', {
      fullPage: true,
      mask: [page.locator('footer')],
    })
  })

  test('sign-up page — validation errors', async ({ page }) => {
    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10000 })

    await page.getByRole('button', { name: 'Sign Up' }).click()
    await expect(page.getByText('Email is required.')).toBeVisible()

    await expect(page).toHaveScreenshot('sign-up-validation-errors.png', {
      fullPage: true,
      mask: [page.locator('footer')],
    })
  })

  test('sign-up page — password mismatch error', async ({ page }) => {
    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10000 })

    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password', { exact: true }).fill('validpass1')
    await page.getByLabel('Confirm password').fill('different1')
    await page.getByRole('button', { name: 'Sign Up' }).click()
    await expect(page.getByText('Passwords do not match.')).toBeVisible()

    await expect(page).toHaveScreenshot('sign-up-password-mismatch.png', {
      fullPage: true,
      mask: [page.locator('footer')],
    })
  })

  test('forgot-password page — email validation error', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByRole('heading', { name: /forgot password/i }).waitFor()
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10000 })

    await page.getByRole('button', { name: 'Send verification code' }).click()
    await expect(page.getByText('Email is required.')).toBeVisible()

    await expect(page).toHaveScreenshot('forgot-password-validation-error.png', {
      fullPage: true,
      mask: [page.locator('footer')],
    })
  })
})
