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
    await page.waitForLoadState('networkidle')

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('sign-in page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page.waitForLoadState('networkidle')

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('sign-up page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/sign-up')
    await page.waitForLoadState('networkidle')

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
  const testEmail = `a11y-test-${Date.now()}@example.com`
  const testPassword = 'TestPassword123!'

  // Sign up and authenticate before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-up')
    await page.waitForLoadState('networkidle')

    await page.getByLabel('Email').fill(testEmail)
    await page.getByLabel('Password', { exact: true }).fill(testPassword)
    await page.getByLabel('Confirm password').fill(testPassword)
    await page.getByRole('button', { name: 'Sign Up' }).click()

    // Wait for redirect to dashboard after successful sign-up
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await page.waitForLoadState('networkidle')
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
    await page.waitForLoadState('networkidle')

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('reports page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/reports')
    await page.waitForLoadState('networkidle')

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
