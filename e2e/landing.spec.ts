import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('should display the landing page', async ({ page }) => {
    await page.goto('/')

    // Check main heading
    await expect(page.getByRole('heading', { level: 2 })).toContainText(
      'Gestisci le tue spese di lavoro'
    )

    // Check navigation buttons in main content
    const main = page.getByRole('main')
    await expect(main.getByRole('link', { name: 'Inizia gratis' })).toBeVisible()
    await expect(main.getByRole('link', { name: 'Accedi' })).toBeVisible()
  })

  test('should navigate to sign in page', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Accedi' }).first().click()

    await expect(page).toHaveURL('/sign-in')
    await expect(page.getByRole('heading', { name: 'Accedi' })).toBeVisible()
  })

  test('should navigate to sign up page', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Registrati' }).first().click()

    await expect(page).toHaveURL('/sign-up')
    await expect(page.getByRole('heading', { name: 'Registrati' })).toBeVisible()
  })
})

test.describe('Authentication Flow', () => {
  test('sign up page should have all required fields', async ({ page }) => {
    await page.goto('/sign-up')

    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Conferma password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Registrati' })).toBeVisible()
  })

  test('sign in page should have forgot password link', async ({ page }) => {
    await page.goto('/sign-in')

    await expect(page.getByText('Password dimenticata?')).toBeVisible()
    await page.getByText('Password dimenticata?').click()

    await expect(page).toHaveURL('/forgot-password')
  })

  test('should show validation for empty form submission', async ({ page }) => {
    await page.goto('/sign-in')

    // Try to submit empty form
    await page.getByRole('button', { name: 'Accedi' }).click()

    // HTML5 validation should prevent submission
    const emailInput = page.getByLabel('Email')
    await expect(emailInput).toHaveAttribute('required')
  })
})
