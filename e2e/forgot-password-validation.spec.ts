import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { waitForHydration } from '../tests/shared/page-readiness'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

test.describe('Forgot-password form validation — email step', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByRole('heading', { name: /forgot password/i }).waitFor()
    await waitForHydration(page)
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

    const emailAlert = page.getByRole('alert').filter({ hasText: 'Email is required.' })
    await expect(emailAlert).toBeVisible()
    await expect(emailAlert).toHaveAttribute('id', 'email-error')

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
