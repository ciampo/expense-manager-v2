import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../shared/auth'

test.describe('Visual Regression - Reports', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('empty state', async ({ page }) => {
    await page.goto('/reports')
    await page.getByRole('heading', { name: /reports/i }).waitFor()
    await page.getByText(/no expense data yet/i).waitFor()

    await expect(page).toHaveScreenshot('reports-empty.png', {
      fullPage: true,
      mask: [page.getByRole('contentinfo')],
    })
  })
})
