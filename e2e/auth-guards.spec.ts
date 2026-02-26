import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'

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
  test('authenticated user navigating to /sign-in should redirect to /dashboard', async ({
    page,
  }) => {
    await signUpTestUser(page)

    await page.goto('/sign-in')
    await page.waitForURL('**/dashboard')

    await expect(page.getByRole('heading', { name: 'Sign In' })).not.toBeVisible()
  })

  test('authenticated user navigating to /sign-up should redirect to /dashboard', async ({
    page,
  }) => {
    await signUpTestUser(page)

    await page.goto('/sign-up')
    await page.waitForURL('**/dashboard')

    await expect(page.getByRole('heading', { name: 'Sign Up' })).not.toBeVisible()
  })
})
