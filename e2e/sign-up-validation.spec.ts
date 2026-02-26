import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { waitForHydration } from '../tests/shared/page-readiness'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

test.describe('Sign-up form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()
    await waitForHydration(page)
  })

  test('shows required-field errors when submitting empty form', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign Up' }).click()

    await expect(page.getByText('Email is required.')).toBeVisible()
    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible()
    await expect(page.getByText('Confirm your password.')).toBeVisible()
  })

  test('shows invalid-email error for malformed email', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Password', { exact: true }).fill('validpass1')
    await page.getByLabel('Confirm password').fill('validpass1')
    await page.getByRole('button', { name: 'Sign Up' }).click()

    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
    await expect(page.getByText('Password must be at least 8 characters.')).not.toBeVisible()
  })

  test('shows password-length error for short password', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password', { exact: true }).fill('short')
    await page.getByLabel('Confirm password').fill('short')
    await page.getByRole('button', { name: 'Sign Up' }).click()

    await expect(page.getByText('Email is required.')).not.toBeVisible()
    await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible()
  })

  test('shows mismatch error when passwords differ', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password', { exact: true }).fill('validpass1')
    await page.getByLabel('Confirm password').fill('different1')
    await page.getByRole('button', { name: 'Sign Up' }).click()

    await expect(page.getByText('Passwords do not match.')).toBeVisible()
    await expect(page.getByText('Email is required.')).not.toBeVisible()
    await expect(page.getByText('Password must be at least 8 characters.')).not.toBeVisible()
  })

  test('error messages use role="alert" for screen readers', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign Up' }).click()

    const emailError = page.locator('#email-error')
    await expect(emailError).toHaveAttribute('role', 'alert')

    const passwordError = page.locator('#password-error')
    await expect(passwordError).toHaveAttribute('role', 'alert')

    const confirmError = page.locator('#confirm-password-error')
    await expect(confirmError).toHaveAttribute('role', 'alert')
  })

  test('invalid fields have aria-invalid="true"', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign Up' }).click()

    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(page.getByLabel('Confirm password')).toHaveAttribute('aria-invalid', 'true')
  })

  test('invalid fields reference their error via aria-describedby', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign Up' }).click()

    await expect(page.getByLabel('Email')).toHaveAttribute('aria-describedby', 'email-error')
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
      'aria-describedby',
      'password-error',
    )
    await expect(page.getByLabel('Confirm password')).toHaveAttribute(
      'aria-describedby',
      'confirm-password-error',
    )
  })

  test('sign-up page with validation errors has no a11y violations', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign Up' }).click()
    await expect(page.getByText('Email is required.')).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations).toEqual([])
  })
})
