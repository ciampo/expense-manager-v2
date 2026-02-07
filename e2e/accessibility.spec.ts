import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Audit', () => {
  test('landing page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('sign-in page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/sign-in')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test('sign-up page should have no accessibility violations', async ({
    page,
  }) => {
    await page.goto('/sign-up')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

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
