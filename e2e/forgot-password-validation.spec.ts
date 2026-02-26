import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

test.describe('Forgot-password form validation — email step', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByRole('heading', { name: /forgot password/i }).waitFor()
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10000 })
  })

  test('shows required-email error when submitting empty form', async ({ page }) => {
    await page.getByRole('button', { name: 'Send verification code' }).click()

    await expect(page.getByText('Email is required.')).toBeVisible()
  })

  test('shows invalid-email error for malformed email', async ({ page }) => {
    await page.getByLabel('Email').fill('bad-email')
    await page.getByRole('button', { name: 'Send verification code' }).click()

    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
  })

  test('email error uses role="alert" and wires aria attributes', async ({ page }) => {
    await page.getByRole('button', { name: 'Send verification code' }).click()

    const emailError = page.locator('#email-error')
    await expect(emailError).toHaveAttribute('role', 'alert')
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-describedby', 'email-error')
  })

  test('forgot-password email step with validation errors has no a11y violations', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Send verification code' }).click()
    await expect(page.getByText('Email is required.')).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations).toEqual([])
  })
})
