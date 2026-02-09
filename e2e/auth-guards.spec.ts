import { test, expect } from '@playwright/test'

test.describe('Auth Guards — unauthenticated redirects', () => {
  test('unauthenticated user navigating to /dashboard should redirect to /sign-in', async ({
    page,
  }) => {
    // Navigate directly to a protected route
    await page.goto('/dashboard')

    // Should redirect to sign-in and not leave dashboard content visible
    await page.waitForURL('**/sign-in')

    // After redirect, dashboard heading should not be visible
    await expect(page.getByRole('heading', { name: 'Dashboard' })).not.toBeVisible()

    // Sign-in form should be visible
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })

  test('unauthenticated user navigating to /reports should redirect to /sign-in', async ({
    page,
  }) => {
    await page.goto('/reports')

    await page.waitForURL('**/sign-in')
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })

  test('unauthenticated user navigating to /expenses/new should redirect to /sign-in', async ({
    page,
  }) => {
    await page.goto('/expenses/new')

    await page.waitForURL('**/sign-in')
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })
})

test.describe('Auth Guards — authenticated redirects', () => {
  const testPassword = 'TestPass123!'

  test('authenticated user navigating to /sign-in should redirect to /dashboard', async ({
    page,
  }) => {
    // Sign up a fresh user to establish an authenticated session
    const uniqueEmail = `auth-guard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10000 })

    await page.getByLabel('Email').fill(uniqueEmail)
    await page.getByLabel('Password', { exact: true }).fill(testPassword)
    await page.getByLabel('Confirm password').fill(testPassword)
    await page.getByRole('button', { name: 'Sign Up' }).click()

    // Wait for sign-up (backend call) + redirect to dashboard.
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await page.locator('header nav').waitFor()

    // Now try to navigate to an auth page — should redirect back to dashboard
    await page.goto('/sign-in')
    await page.waitForURL('**/dashboard')

    // Dashboard should be visible, sign-in form should not
    await expect(page.getByRole('heading', { name: 'Sign In' })).not.toBeVisible()
  })

  test('authenticated user navigating to /sign-up should redirect to /dashboard', async ({
    page,
  }) => {
    const uniqueEmail = `auth-guard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10000 })

    await page.getByLabel('Email').fill(uniqueEmail)
    await page.getByLabel('Password', { exact: true }).fill(testPassword)
    await page.getByLabel('Confirm password').fill(testPassword)
    await page.getByRole('button', { name: 'Sign Up' }).click()

    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await page.locator('header nav').waitFor()

    // Navigate to sign-up — should redirect back to dashboard
    await page.goto('/sign-up')
    await page.waitForURL('**/dashboard')

    await expect(page.getByRole('heading', { name: 'Sign Up' })).not.toBeVisible()
  })
})
