import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { waitForHydration } from '../tests/shared/page-readiness'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

test.describe('Sign-in form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByRole('heading', { name: /sign in/i }).waitFor()
    await waitForHydration(page)
  })

  test('shows required-field errors when submitting empty form', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByText('Email is required.')).toBeVisible()
    await expect(page.getByText('Password is required.')).toBeVisible()
  })

  test('shows invalid-email error for malformed email', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Password', { exact: true }).fill('anything')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
    await expect(page.getByText('Password is required.')).not.toBeVisible()
  })

  test('does not show email-required error when only password is empty', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByText('Email is required.')).not.toBeVisible()
    await expect(page.getByText('Password is required.')).toBeVisible()
  })

  test('error messages use role="alert" for screen readers', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign In' }).click()

    const emailAlert = page.getByRole('alert').filter({ hasText: 'Email is required.' })
    await expect(emailAlert).toBeVisible()
    await expect(emailAlert).toHaveAttribute('id', 'email-error')

    const passwordAlert = page.getByRole('alert').filter({ hasText: 'Password is required.' })
    await expect(passwordAlert).toBeVisible()
    await expect(passwordAlert).toHaveAttribute('id', 'password-error')
  })

  test('invalid fields have aria-invalid="true"', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  test('invalid fields reference their error via aria-describedby', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByLabel('Email')).toHaveAttribute('aria-describedby', 'email-error')
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
      'aria-describedby',
      'password-error',
    )
  })

  test('forgot-password link navigates to /forgot-password', async ({ page }) => {
    await page.getByRole('link', { name: /forgot password/i }).click()

    await expect(page).toHaveURL('/forgot-password')
  })

  test('sign-in page with validation errors has no a11y violations', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText('Email is required.')).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations).toEqual([])
  })
})
