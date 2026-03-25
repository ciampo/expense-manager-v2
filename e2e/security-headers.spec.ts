import { test, expect } from '@playwright/test'

test.describe('Security Headers', () => {
  test('should serve an enforcing CSP header with a nonce on GET', async ({ page }) => {
    const response = await page.goto('/')
    const csp = response?.headers()['content-security-policy']

    expect(csp).toBeDefined()
    expect(csp).not.toContain('Report-Only')
    expect(csp).toMatch(/script-src[^;]*'strict-dynamic'/)
    expect(csp).toMatch(/script-src[^;]*'nonce-[A-Za-z0-9+/]+=*'/)
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
  })

  test('should stamp inline scripts with a nonce matching the CSP header', async ({ request }) => {
    const response = await request.get('/')
    const csp = response.headers()['content-security-policy'] ?? ''

    const headerNonce = csp.match(/'nonce-([A-Za-z0-9+/]+=*)'/)?.[1]
    expect(headerNonce).toBeTruthy()

    // Use the raw HTTP response (not the live DOM) because browsers
    // clear nonce attributes after script execution.
    const html = await response.text()
    const noncePattern = /nonce="([A-Za-z0-9+/]+=*)"/g
    const htmlNonces = [...html.matchAll(noncePattern)].map((m) => m[1])

    expect(htmlNonces.length).toBeGreaterThan(0)
    for (const n of htmlNonces) {
      expect(n).toBe(headerNonce)
    }
  })

  test('should generate a unique nonce per request', async ({ page, request }) => {
    const res1 = await page.goto('/')
    const nonce1 = res1
      ?.headers()
      ['content-security-policy']?.match(/'nonce-([A-Za-z0-9+/]+=*)'/)?.[1]

    const res2 = await request.get('/')
    const nonce2 = res2
      .headers()
      ['content-security-policy']?.match(/'nonce-([A-Za-z0-9+/]+=*)'/)?.[1]

    expect(nonce1).toBeTruthy()
    expect(nonce2).toBeTruthy()
    expect(nonce1).not.toBe(nonce2)
  })

  test('should include all static security headers', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers() ?? {}

    expect(headers['strict-transport-security']).toContain('max-age=')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['permissions-policy']).toBeTruthy()
  })

  test('should serve a CSP header on HEAD requests', async ({ request }) => {
    const response = await request.head('/')
    const csp = response.headers()['content-security-policy']

    expect(csp).toBeDefined()
    expect(csp).toMatch(/script-src[^;]*'nonce-/)
  })

  test('should not include a CSP header on non-GET responses', async ({ request }) => {
    const response = await request.post('/', { data: '' })
    const csp = response.headers()['content-security-policy']

    expect(csp).toBeUndefined()
  })

  test('should not have console CSP violation errors on the landing page', async ({ page }) => {
    const violations: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Content-Security-Policy')) {
        violations.push(msg.text())
      }
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    expect(violations).toHaveLength(0)
  })
})
