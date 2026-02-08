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

  // Sign up a fresh user before each test. Each test gets its own
  // browser context (no shared session), so we need a unique email
  // per test to avoid "email already taken" errors.
  test.beforeEach(async ({ page }) => {
    const uniqueEmail = `a11y-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()

    await page.getByLabel('Email').fill(uniqueEmail)
    await page.getByLabel('Password', { exact: true }).fill(testPassword)
    await page.getByLabel('Confirm password').fill(testPassword)
    await page.getByRole('button', { name: 'Sign Up' }).click()

    // Wait for redirect to dashboard after successful sign-up
    await page.waitForURL('**/dashboard', { timeout: 30000 })
    // Wait for the dashboard to fully render (main content area visible)
    await page.locator('main#main-content').waitFor()
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
    await page.getByRole('button', { name: /save/i }).waitFor()

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('reports page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/reports')
    // Wait for the reports page to render
    await page.locator('main#main-content').waitFor()

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
