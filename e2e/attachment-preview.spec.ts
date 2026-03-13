import { test, expect } from '@playwright/test'
import { signUpTestUser } from '../tests/shared/auth'
import { createExpenseWithAttachment } from '../tests/shared/expenses'

test.describe('Attachment hover card preview', () => {
  test.setTimeout(90_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
  })

  test('hover card appears with image preview and view-full link', async ({ page }) => {
    await createExpenseWithAttachment(page, 'Image Preview Shop', '10,00', { type: 'png' })

    const trigger = page.getByRole('button', { name: /has attachment/i })
    await expect(trigger).toBeVisible()

    await trigger.hover()

    await expect(page.getByAltText('Attachment preview')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('link', { name: /view full/i })).toBeVisible()
  })

  test('hover card shows fallback for non-image attachment', async ({ page }) => {
    await createExpenseWithAttachment(page, 'PDF Preview Shop', '10,00', { type: 'pdf' })

    const trigger = page.getByRole('button', { name: /has attachment/i })
    await expect(trigger).toBeVisible()

    await trigger.hover()

    await expect(page.getByText('File attachment')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('link', { name: /view full/i })).toBeVisible()
  })

  test('hover card opens on keyboard focus', async ({ page }) => {
    await createExpenseWithAttachment(page, 'Keyboard Focus Shop', '10,00', { type: 'png' })

    const trigger = page.getByRole('button', { name: /has attachment/i })
    await expect(trigger).toBeVisible()

    await trigger.focus()

    await expect(page.getByRole('link', { name: /view full/i })).toBeVisible({ timeout: 10_000 })
  })

  test('view-full link opens in new tab with correct href', async ({ page }) => {
    await createExpenseWithAttachment(page, 'Link Target Shop', '10,00', { type: 'png' })

    const trigger = page.getByRole('button', { name: /has attachment/i })
    await expect(trigger).toBeVisible()
    await trigger.hover()

    const link = page.getByRole('link', { name: /view full/i })
    await expect(link).toBeVisible({ timeout: 10_000 })

    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
    await expect(link).toHaveAttribute('href', /^https?:\/\//)
  })

  test('hover card closes when cursor moves away', async ({ page }) => {
    await createExpenseWithAttachment(page, 'Dismiss Shop', '10,00', { type: 'png' })

    const trigger = page.getByRole('button', { name: /has attachment/i })
    await expect(trigger).toBeVisible()
    await trigger.hover()

    const link = page.getByRole('link', { name: /view full/i })
    await expect(link).toBeVisible({ timeout: 10_000 })

    await page.mouse.move(0, 0)

    await expect(link).not.toBeVisible({ timeout: 5_000 })
  })
})
