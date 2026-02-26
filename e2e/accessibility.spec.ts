import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signUpTestUser } from '../tests/shared/auth'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function runAxeAudit(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
}

// ── Public pages ──────────────────────────────────────────────

test.describe('Accessibility Audit — Public Pages', () => {
  test('landing page should have no accessibility violations', async ({ page }) => {
    await page.goto('/')
    // Wait for the hero heading to confirm the page has rendered
    await page.getByRole('heading', { name: /expense manager/i }).waitFor()

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('sign-in page should have no accessibility violations', async ({ page }) => {
    await page.goto('/sign-in')
    await page.getByRole('heading', { name: /sign in/i }).waitFor()

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('sign-up page should have no accessibility violations', async ({ page }) => {
    await page.goto('/sign-up')
    await page.getByRole('heading', { name: /sign up/i }).waitFor()

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('forgot-password page should have no accessibility violations', async ({ page }) => {
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

  test('landing page header should contain a nav landmark', async ({ page }) => {
    await page.goto('/')

    const nav = page.locator('header nav')
    await expect(nav).toHaveCount(1)
  })
})

// ── Authenticated pages ───────────────────────────────────────

test.describe('Accessibility Audit — Authenticated Pages', () => {
  test.setTimeout(45000)

  // Sign up a fresh user before each test. Each test gets its own
  // browser context (no shared session), so we need a unique email
  // per test to avoid "email already taken" errors.
  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('dashboard should have no accessibility violations', async ({ page }) => {
    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('new expense page should have no accessibility violations', async ({ page }) => {
    await page.goto('/expenses/new')
    // Wait for the expense form to render
    await page.getByRole('button', { name: /create expense/i }).waitFor()

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('reports page should have no accessibility violations', async ({ page }) => {
    await page.goto('/reports')
    // Wait for the reports page content to resolve (Suspense boundary settled).
    // A fresh user has no expenses, so the empty-state message appears.
    await page.getByText('No expense data yet').waitFor()

    const results = await runAxeAudit(page)
    expect(results.violations).toEqual([])
  })

  test('authenticated layout should have a nav landmark', async ({ page }) => {
    const nav = page.locator('header nav')
    await expect(nav).toHaveCount(1)
  })
})
