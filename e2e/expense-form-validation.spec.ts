import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signUpTestUser } from '../tests/shared/auth'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

test.describe('Expense form validation', () => {
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await signUpTestUser(page)
    await page.goto('/expenses/new')
    await page.getByRole('button', { name: /create expense/i }).waitFor()
  })

  test('shows required-field errors when submitting empty form', async ({ page }) => {
    await page.getByRole('button', { name: /create expense/i }).click()

    await expect(page.getByText('Merchant name is required.')).toBeVisible()
    await expect(page.getByText('Amount must be positive.')).toBeVisible()
    await expect(page.getByText('Select or create a category.')).toBeVisible()
  })

  test('shows only remaining errors after filling some fields', async ({ page }) => {
    await page.getByRole('combobox', { name: /merchant/i }).click()
    await page.getByPlaceholder(/search or create/i).fill('Test Merchant')
    await page.getByRole('option', { name: '+ Use "Test Merchant"', exact: true }).click()
    await expect(page.getByPlaceholder(/search or create/i)).toHaveCount(0)

    await page.getByRole('button', { name: /create expense/i }).click()

    await expect(page.getByText('Merchant name is required.')).not.toBeVisible()
    await expect(page.getByText('Amount must be positive.')).toBeVisible()
    await expect(page.getByText('Select or create a category.')).toBeVisible()
  })

  test('error messages use role="alert" for screen readers', async ({ page }) => {
    await page.getByRole('button', { name: /create expense/i }).click()

    const merchantAlert = page.getByRole('alert').filter({ hasText: 'Merchant name is required.' })
    await expect(merchantAlert).toBeVisible()
    await expect(merchantAlert).toHaveAttribute('id', 'merchant-error')

    const amountAlert = page.getByRole('alert').filter({ hasText: 'Amount must be positive.' })
    await expect(amountAlert).toBeVisible()
    await expect(amountAlert).toHaveAttribute('id', 'amount-error')

    const categoryAlert = page.getByRole('alert').filter({
      hasText: 'Select or create a category.',
    })
    await expect(categoryAlert).toBeVisible()
    await expect(categoryAlert).toHaveAttribute('id', 'category-error')
  })

  test('invalid fields have aria-invalid="true"', async ({ page }) => {
    await page.getByRole('button', { name: /create expense/i }).click()

    await expect(page.getByRole('combobox', { name: /merchant/i })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(page.getByLabel(/amount/i)).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('combobox', { name: /category/i })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  test('invalid fields reference their error via aria-describedby', async ({ page }) => {
    await page.getByRole('button', { name: /create expense/i }).click()

    await expect(page.getByRole('combobox', { name: /merchant/i })).toHaveAttribute(
      'aria-describedby',
      'merchant-error',
    )
    await expect(page.getByLabel(/amount/i)).toHaveAttribute('aria-describedby', 'amount-error')
    await expect(page.getByRole('combobox', { name: /category/i })).toHaveAttribute(
      'aria-describedby',
      'category-error',
    )
  })

  test('expense form with validation errors has no a11y violations', async ({ page }) => {
    await page.getByRole('button', { name: /create expense/i }).click()
    await expect(page.getByText('Merchant name is required.')).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations).toEqual([])
  })
})
