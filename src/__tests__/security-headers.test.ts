import { describe, it, expect } from 'vitest'
import { SECURITY_HEADERS, CSP_REPORT_PATH, addSecurityHeaders } from '@/lib/security-headers'

describe('SECURITY_HEADERS', () => {
  it('defines all expected header names', () => {
    const names = Object.keys(SECURITY_HEADERS)
    expect(names).toContain('Strict-Transport-Security')
    expect(names).toContain('X-Content-Type-Options')
    expect(names).toContain('X-Frame-Options')
    expect(names).toContain('Referrer-Policy')
    expect(names).toContain('Permissions-Policy')
    expect(names).toContain('Reporting-Endpoints')
    expect(names).toContain('Content-Security-Policy-Report-Only')
  })

  it('includes Convex origins in connect-src', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy-Report-Only']
    expect(csp).toContain('https://*.convex.cloud')
    expect(csp).toContain('wss://*.convex.cloud')
  })

  it('includes Turnstile origin in script-src and frame-src', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy-Report-Only']
    expect(csp).toMatch(/script-src[^;]*https:\/\/challenges\.cloudflare\.com/)
    expect(csp).toMatch(/frame-src[^;]*https:\/\/challenges\.cloudflare\.com/)
  })

  it('includes frame-ancestors for clickjacking protection', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy-Report-Only']
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('includes report-to and report-uri directives', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy-Report-Only']
    expect(csp).toContain('report-to csp-endpoint')
    expect(csp).toContain(`report-uri ${CSP_REPORT_PATH}`)
  })

  it('configures Reporting-Endpoints header pointing to CSP_REPORT_PATH', () => {
    expect(SECURITY_HEADERS['Reporting-Endpoints']).toBe(`csp-endpoint="${CSP_REPORT_PATH}"`)
  })

  it('includes preload in HSTS header', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toContain('preload')
  })
})

describe('addSecurityHeaders', () => {
  it('adds all security headers to a response', () => {
    const original = new Response('hello', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })

    const secured = addSecurityHeaders(original)

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(secured.headers.get(name)).toBe(value)
    }
  })

  it('preserves the original response body and status', async () => {
    const original = new Response('test body', { status: 201, statusText: 'Created' })

    const secured = addSecurityHeaders(original)

    expect(secured.status).toBe(201)
    expect(secured.statusText).toBe('Created')
    expect(await secured.text()).toBe('test body')
  })

  it('preserves existing headers from the original response', () => {
    const original = new Response(null, {
      headers: { 'X-Custom': 'keep-me' },
    })

    const secured = addSecurityHeaders(original)

    expect(secured.headers.get('X-Custom')).toBe('keep-me')
  })

  it('overwrites conflicting upstream headers', () => {
    const original = new Response(null, {
      headers: { 'X-Frame-Options': 'SAMEORIGIN' },
    })

    const secured = addSecurityHeaders(original)

    expect(secured.headers.get('X-Frame-Options')).toBe('DENY')
  })
})
