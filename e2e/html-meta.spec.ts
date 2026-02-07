import { test, expect } from '@playwright/test'

test.describe('HTML and Meta Tags', () => {
  test('html element should have lang="en"', async ({ page }) => {
    await page.goto('/')

    const lang = await page.getAttribute('html', 'lang')
    expect(lang).toBe('en')
  })

  test('should have a meta description tag', async ({ page }) => {
    await page.goto('/')

    const metaDescription = page.locator('meta[name="description"]')
    await expect(metaDescription).toHaveCount(1)

    const content = await metaDescription.getAttribute('content')
    expect(content).toBeTruthy()
    expect(content!.length).toBeGreaterThan(10)
  })

  test('should not load duplicate font stylesheets', async ({ page }) => {
    await page.goto('/')

    // Check that Google Fonts is not loaded (we use @fontsource-variable/noto-sans)
    const googleFontLinks = page.locator(
      'link[rel="stylesheet"][href*="fonts.googleapis.com"]'
    )
    await expect(googleFontLinks).toHaveCount(0)
  })
})
