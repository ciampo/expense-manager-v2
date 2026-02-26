import { test, expect } from '@playwright/test'
import { signUpTestUser } from './utils'

test.describe('Visual Regression - Reports', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('empty state', async ({ page }) => {
    await page.goto('/reports')
    await page.locator('body[data-hydrated="true"]').waitFor({ timeout: 10_000 })

    await expect(page).toHaveScreenshot('reports-empty.png', {
      fullPage: true,
      mask: [page.locator('footer')],
    })
  })
})
