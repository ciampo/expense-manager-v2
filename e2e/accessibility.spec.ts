import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function runAxeAudit(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
}

// ── Public pages ──────────────────────────────────────────────

test.describe('Accessibility Audit — Public Pages', () => {
  test('landing page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/')
    // Wait for the hero heading to confirm the page has rendered
    await page.getByRole('heading', { name: /expense manager/i }).waitFor()

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('sign-in page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page.getByRole('heading', { name: /sign in/i }).waitFor()

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('sign-up page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('forgot-password page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/forgot-password')
    await page.getByRole('heading', { name: /forgot password/i }).waitFor()

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('should have a skip-to-content link', async ({ page }) => {
    await page.goto('/')

    // The skip link should exist (may be visually hidden)
    const skipLink = page.getByRole('link', { name: /skip/i })
    await expect(skipLink).toHaveCount(1)

    // Should have an href pointing to the main content
    const href = await skipLink.getAttribute('href')
    expect(href).toBe('#main-content')
  })

  test('landing page header should contain a nav landmark', async ({
    page,
  }) => {
    await page.goto('/')

    const nav = page.locator('header nav')
    await expect(nav).toHaveCount(1)
  })
})

// ── Authenticated pages ───────────────────────────────────────

test.describe('Accessibility Audit — Authenticated Pages', () => {
  const testPassword = 'TestPassword123!'

  // Authenticated tests need more time: sign-up + page render + axe audit
  test.setTimeout(60000)

  // Sign up a fresh user before each test. Each test gets its own
  // browser context (no shared session), so we need a unique email
  // per test to avoid "email already taken" errors.
  test.beforeEach(async ({ page }) => {
    const uniqueEmail = `a11y-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()

    // Wait for client-side hydration to complete before interacting.
    // TanStack Start renders the page via SSR, but React event handlers
    // aren't attached until hydration finishes. Without this wait,
    // clicking the submit button triggers a native form GET submit
    // (URL becomes /sign-up?) instead of React's onSubmit handler.
    //
    // The root component sets data-hydrated="true" on <body> inside a
    // useEffect, which fires only after React has mounted (hydrated).
    // This is a stable, framework-agnostic signal that doesn't depend
    // on React internals (__reactFiber, etc.).
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 15000 })

    await page.getByLabel('Email').fill(uniqueEmail)
    await page.getByLabel('Password', { exact: true }).fill(testPassword)
    await page.getByLabel('Confirm password').fill(testPassword)
    await page.getByRole('button', { name: 'Sign Up' }).click()

    // Wait for redirect to dashboard after successful sign-up.
    // Use a shorter timeout than the test timeout so we have time
    // to capture diagnostics if sign-up fails.
    try {
      await page.waitForURL('**/dashboard', { timeout: 30000 })
    } catch {
      const url = page.url()
      const bodyText = await page
        .locator('body')
        .innerText()
        .catch(() => 'could not read body')
      throw new Error(
        `Sign-up did not redirect to /dashboard. ` +
          `Stuck on: ${url}. ` +
          `Page content: ${bodyText.slice(0, 500)}`
      )
    }
    // Wait for the authenticated layout to fully render (nav is only in the
    // real layout, not in the pendingComponent skeleton).
    await page.locator('header nav').waitFor({ timeout: 10000 })
  })

  test('dashboard should have no accessibility violations', async ({
    page,
  }) => {
    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('new expense page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/expenses/new')
    // Wait for the expense form to render
    await page.getByRole('button', { name: /create expense/i }).waitFor()

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('reports page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/reports')
    // Wait for the authenticated layout to fully render (nav is only in the
    // real layout, not in the pendingComponent skeleton).
    await page.locator('header nav').waitFor({ timeout: 10000 })

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('authenticated layout should have a nav landmark', async ({
    page,
  }) => {
    const nav = page.locator('header nav')
    await expect(nav).toHaveCount(1)
  })
})
