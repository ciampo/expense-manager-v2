import type { Page } from '@playwright/test'
import { waitForHydration } from './page-readiness'

const TEST_PASSWORD = 'TestPassword123!'

/**
 * Sign up a fresh test user and wait until the authenticated dashboard
 * is ready. Works on both desktop and mobile viewports.
 *
 * Provides descriptive errors when the flow stalls — helpful for CI debugging.
 */
export async function signUpTestUser(page: Page): Promise<void> {
  const uniqueEmail = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

  await page.goto('/sign-up')
  await page.getByRole('heading', { name: /sign up/i }).waitFor()
  await waitForHydration(page)

  await page.getByLabel('Email').fill(uniqueEmail)
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
  await page.getByLabel('Confirm password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign Up' }).click()

  try {
    await page.waitForURL('**/dashboard', { timeout: 15_000 })
  } catch {
    const url = page.url()
    const bodyText = await page
      .locator('body')
      .innerText()
      .catch(() => 'could not read body')
    throw new Error(
      `Sign-up did not redirect to /dashboard. Stuck on: ${url}. Page: ${bodyText.slice(0, 500)}`,
    )
  }

  await page.getByRole('heading', { name: /dashboard/i }).waitFor({ timeout: 10_000 })
}
