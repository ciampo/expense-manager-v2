import { test, expect } from '@playwright/test'

test.describe('Auth Guards', () => {
  test('unauthenticated user navigating to /dashboard should redirect to /sign-in', async ({
    page,
  }) => {
    // Navigate directly to a protected route
    await page.goto('/dashboard')

    // Should redirect to sign-in without ever rendering dashboard content
    await page.waitForURL('/sign-in', { timeout: 10000 })

    // The dashboard heading should never have been in the DOM
    await expect(page.getByRole('heading', { name: 'Dashboard' })).not.toBeVisible()

    // Sign-in form should be visible
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })

  test('unauthenticated user navigating to /reports should redirect to /sign-in', async ({
    page,
  }) => {
    await page.goto('/reports')

    await page.waitForURL('/sign-in', { timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })

  test('unauthenticated user navigating to /expenses/new should redirect to /sign-in', async ({
    page,
  }) => {
    await page.goto('/expenses/new')

    await page.waitForURL('/sign-in', { timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })
})
